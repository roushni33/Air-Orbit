/*
 * BookingRepository
 *
 * Extends CrudRepository with Booking-specific data access methods.
 * Overrides get, update, and create from the base class to add transaction support,
 * since the booking flow requires multiple queries to be atomic.
 *
 * Also adds cancelOldBookings — a bulk update query used by the cron job,
 * which cannot be expressed through the generic CrudRepository interface.
 */

const { StatusCodes } = require('http-status-codes');
const AppError = require('../utils/errors/app-error');
const db = require('../db');
const { bookings } = require('../db/schema');
const CrudRepository = require('./crud-repository');
const { eq, and, lt, ne, notInArray, inArray, desc } = require('drizzle-orm');
const { ENUMS } = require('../utils/common');
const { BOOKED, CANCELLED, INITIATED } = ENUMS.BOOKING_STATUS;

class BookingRepository extends CrudRepository {
    constructor() {
        super(bookings);
    }

    /*
     * createBooking (override of base create)
     * Creates a new booking row inside a transaction.
     * The base class create() has no transaction support, so we override it here.
     *
     * Receives: data (booking fields), transaction (Sequelize transaction object)
     * Returns:  newly created Booking instance
     */
    async createBooking(data, tx = db) {
        return await this.create(data, tx);
    }

    /*
     * getOldBookings
     * Fetches all INITIATED/PENDING bookings older than the given timestamp.
     * Called by the cron job BEFORE cancelling, so we have the data needed
     * to publish seat restoration events to RabbitMQ.
     *
     * Receives: timestamp (Date) — cutoff time (now - 5 minutes)
     * Returns:  array of Booking instances (may be empty)
     */
    async getOldBookings(timestamp) {
        return await db.select().from(bookings).where(
            and(
                lt(bookings.createdAt, timestamp),
                notInArray(bookings.status, [BOOKED, CANCELLED])
            )
        );
    }

    /*
     * cancelBookingsByIds
     * Bulk UPDATE — cancels exactly the bookings identified by the given IDs.
     * Called after getOldBookings so we cancel precisely what we selected,
     * avoiding race conditions from using the time filter twice.
     *
     * Receives: ids (number[]) — array of booking primary keys
     * Returns:  [ affectedRows ]
     */
    async cancelBookingsByIds(ids) {
        if (!ids || ids.length === 0) return [0];
        const response = await db.update(bookings)
            .set({ status: CANCELLED })
            .where(
                and(
                    inArray(bookings.id, ids),
                    notInArray(bookings.status, [BOOKED, CANCELLED])
                )
            ).returning();
        return [response.length];
    }

    /*
     * getBookingsByUserId
     * Fetches all bookings for a given user, ordered newest first.
     * Used by the GET /my-bookings endpoint.
     *
     * Receives: userId (number)
     * Returns:  array of Booking instances (may be empty)
     */
    async getBookingsByUserId(userId) {
        return await db.select().from(bookings)
            .where(eq(bookings.userId, userId))
            .orderBy(desc(bookings.createdAt));
    }

    /*
     * cancelOldBookings
     * Bulk UPDATE — cancels all bookings that are:
     *   - older than the provided timestamp (createdAt < timestamp, i.e. older than 5 mins ago)
     *   - NOT already BOOKED (don't touch completed bookings)
     *   - NOT already CANCELLED (avoid redundant updates)
     *
     * This effectively targets INITIATED and PENDING bookings that were abandoned.
     * Called by the cron job every 2 minutes via BookingService.cancelOldBookings().
     *
     * Single bulk query — no row-by-row looping, efficient regardless of row count.
     *
     * Receives: timestamp (Date) — the cutoff time (now - 5 minutes)
     * Returns:  [ affectedRows ] — 0 means no abandoned bookings found this tick
     */
    async cancelOldBookings(timestamp) {
        const response = await db.update(bookings)
            .set({ status: CANCELLED })
            .where(
                and(
                    lt(bookings.createdAt, timestamp),
                    ne(bookings.status, BOOKED),
                    ne(bookings.status, CANCELLED)
                )
            ).returning();
        return [response.length];
    }
}

module.exports = BookingRepository;
