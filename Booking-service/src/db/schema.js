const { pgTable, serial, integer, pgEnum, timestamp } = require('drizzle-orm/pg-core');
const { ENUMS } = require('../utils/common');
const { BOOKED, CANCELLED, INITIATED, PENDING } = ENUMS.BOOKING_STATUS;
const { ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST_CLASS } = ENUMS.SEAT_TYPE;

const statusEnum = pgEnum('status', [BOOKED, CANCELLED, INITIATED, PENDING]);
const seatClassEnum = pgEnum('seat_class', [ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST_CLASS]);

const bookings = pgTable('bookings', {
  id: serial('id').primaryKey(),
  flightId: integer('flight_id').notNull(),
  userId: integer('user_id').notNull(),
  status: statusEnum('status').default(INITIATED).notNull(),
  totalCost: integer('total_cost').notNull(),
  noOfSeats: integer('no_of_seats'),
  seatClass: seatClassEnum('seat_class'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

module.exports = {
  statusEnum,
  seatClassEnum,
  bookings
};
