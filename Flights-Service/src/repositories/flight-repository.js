const CrudRepository = require('./crud-repository.js');
const db = require('../db');
const { flights, airplanes, airports, cities, flightClasses, flightStops } = require('../db/schema');
const AppError = require('../utils/errors/app-error');
const { StatusCodes } = require('http-status-codes');
const { eq, and, sql, sql: { raw } } = require('drizzle-orm');

class FlightRepository extends CrudRepository {
    constructor(){
        super(flights);
    }

    /**
     * Fetches all flights matching the given filter and sort criteria.
     * Eagerly loads Airplane, departure/arrival Airports (with Cities), all FlightClasses,
     * and FlightStops so the response is self-contained.
     *
     * When classFilter is non-empty an INNER JOIN is applied on FlightClasses, meaning only
     * flights that have at least one class satisfying the filter (price range, seat count) are
     * returned.  When classFilter is empty all FlightClass rows are included (LEFT JOIN).
     *
     * @param {Object} flightFilter - Sequelize WHERE conditions on the Flights table (trips, tripDate).
     * @param {Object} classFilter  - Sequelize WHERE conditions on the FlightClasses table (price, travellers).
     * @param {Array}  sort         - Sequelize ORDER clause (e.g. [['price','ASC'],['departureTime','DESC']]).
     * @returns {Promise<Flight[]>} Array of Flight instances with nested associations.
     */
    async getAllFlights(flightFilter, classFilter, sort){
        // Since filtering with relations is tricky in basic relational queries with dynamic where,
        // we map the provided filter structures to Drizzle 'where' dynamically or use db.query.flights.findMany
        const response = await db.query.flights.findMany({
            where: flightFilter,
            orderBy: sort,
            with: {
                airplaneDetails: true,
                departureAirport: { with: { city: true } },
                arrivalAirport: { with: { city: true } },
                FlightClasses: {
                    where: classFilter
                },
                FlightStops: true
            }
        });
        
        // Emulate INNER JOIN for FlightClasses (if classFilter is present, exclude flights without matching classes)
        if (classFilter) {
            return response.filter(f => f.FlightClasses && f.FlightClasses.length > 0);
        }
        return response;
    }

    /**
     * Fetches a single flight by primary key with all associations eager-loaded.
     * Used by the Booking Service (via GET /flights/:id) to retrieve cabin-class pricing
     * and seat availability before creating a booking.
     *
     * Overrides the base CrudRepository.get() which returns a bare Flight instance with
     * no includes — insufficient for the booking flow.
     *
     * @param {number} id - Primary key of the flight to fetch.
     * @returns {Promise<Flight>} Flight instance with Airplane, Airports, Cities, FlightClasses, FlightStops.
     * @throws {AppError} NOT_FOUND if no flight exists with this id.
     */
    async getFlight(id){
        const response = await db.query.flights.findFirst({
            where: eq(flights.id, id),
            with: {
                airplaneDetails: true,
                departureAirport: { with: { city: true } },
                arrivalAirport: { with: { city: true } },
                FlightClasses: true,
                FlightStops: true
            }
        });

        if(!response){
            throw new AppError('Not able to find a resource', StatusCodes.NOT_FOUND);
        }
        return response;
    }

    /**
     * Creates a flight together with its cabin-class inventory rows in a single transaction.
     * Called when the request body contains a seatClasses array (the v2 create path).
     *
     * The economy class price and seat count are mirrored onto the Flight row so that the
     * existing Booking Service HTTP call (which reads flight.price / flight.totalSeats) keeps
     * working until Stage 6 removes those columns.
     *
     * @param {Object}   data             - All flight fields plus a seatClasses array.
     * @param {Array}    data.seatClasses - [{ seatClass, price, totalSeats }, ...] — one entry per cabin.
     * @returns {Promise<Flight>} The newly created Flight instance.
     */
    async createFlightWithClasses(data, tx = db){
        return await tx.transaction(async (transaction) => {
            const { seatClasses, ...flightData } = data;

            const economy = seatClasses.find(c => c.seatClass === 'economy');
            if(economy){
                flightData.price      = flightData.price      || economy.price;
                flightData.totalSeats = flightData.totalSeats || economy.totalSeats;
            }

            const [flight] = await transaction.insert(flights).values({
                ...flightData,
                departureTime: new Date(flightData.departureTime),
                arrivalTime: new Date(flightData.arrivalTime),
            }).returning();

            const classRows = seatClasses.map(c => ({
                flightId:   flight.id,
                seatClass:  c.seatClass,
                price:      c.price,
                totalSeats: c.totalSeats
            }));
            
            if (classRows.length > 0) {
                await transaction.insert(flightClasses).values(classRows);
            }

            return flight;
        });
    }

    /**
     * Atomically increments or decrements the totalSeats count for a flight.
     * Uses a database transaction with a row-level lock (SELECT ... FOR UPDATE) to
     * prevent race conditions when multiple booking requests arrive simultaneously.
     *
     * @param {number}  flightId - Primary key of the flight to update.
     * @param {number}  seats    - Number of seats to add or subtract.
     * @param {boolean} dec      - true → decrement (booking), false → increment (cancellation). Defaults to true.
     * @returns {Promise<Flight>} The updated Flight instance reflecting the new seat count.
     */
    async updateRemainingSeats(flightId, seats, dec = true){
        return await db.transaction(async (transaction) => {
            const response = await transaction.select().from(flights)
                .where(eq(flights.id, flightId))
                .for('update');
            
            if (response.length === 0) {
                throw new AppError('Flight not found', StatusCodes.NOT_FOUND);
            }
            const flight = response[0];

            let newSeats = flight.totalSeats;
            if (+dec) {
                newSeats -= seats;
            } else {
                newSeats += seats;
            }

            const [updatedFlight] = await transaction.update(flights)
                .set({ totalSeats: newSeats })
                .where(eq(flights.id, flightId))
                .returning();
            
            return updatedFlight;
        });
    }

    /**
     * Atomically increments or decrements the totalSeats count for a specific cabin class.
     * Same locking pattern as updateRemainingSeats but targets FlightClasses instead of Flights,
     * since seat inventory now lives at the cabin-class level.
     *
     * @param {number}  flightId  - FK of the flight whose class is being updated.
     * @param {string}  seatClass - Cabin class: 'economy' | 'premium-economy' | 'business' | 'first-class'.
     * @param {number}  seats     - Number of seats to add or subtract.
     * @param {boolean} dec       - true → decrement (booking), false → increment (cancellation). Defaults to true.
     * @returns {Promise<FlightClass>} The updated FlightClass instance reflecting the new seat count.
     */
    async updateRemainingClassSeats(flightId, seatClass, seats, dec = true){
        return await db.transaction(async (transaction) => {
            const response = await transaction.select().from(flightClasses)
                .where(and(eq(flightClasses.flightId, flightId), eq(flightClasses.seatClass, seatClass)))
                .for('update');
            
            if (response.length === 0) {
                throw new AppError(
                    `No ${seatClass} class found for flight ${flightId}`,
                    StatusCodes.NOT_FOUND
                );
            }

            const flightCls = response[0];

            let newSeats = flightCls.totalSeats;
            if (+dec) {
                newSeats -= seats;
            } else {
                newSeats += seats;
            }

            const [updatedFlightClass] = await transaction.update(flightClasses)
                .set({ totalSeats: newSeats })
                .where(and(eq(flightClasses.flightId, flightId), eq(flightClasses.seatClass, seatClass)))
                .returning();
            
            return updatedFlightClass;
        });
    }
}

module.exports = FlightRepository;
