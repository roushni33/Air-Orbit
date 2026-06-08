const { FlightRepository } = require('../repositories');
const AppError = require('../utils/errors/app-error');
const { StatusCodes } = require('http-status-codes');
const { compareTime } = require('../utils/helpers/datetime-helpers');
const { and, between, gte, gt, eq, asc, desc } = require('drizzle-orm');
const { flights, flightClasses } = require('../db/schema');
const { Redis } = require('../config');
const flightRepository = new FlightRepository();

// Search results cached for 4 hours.
// Results page shows only indicative "from" prices for discovery — seat counts
// and live prices are on FlightDetailPage which always hits the DB directly.
// The only stale "lie" is showing a possibly sold-out flight in results, which
// resolves immediately when the user clicks Select and sees the live detail page.
const CACHE_TTL = 4 * 60 * 60;

/**
 * Validates the departure/arrival times and creates a new flight record in the database.
 * When the request body contains a seatClasses array the repository creates the Flight and
 * all FlightClass rows together in one transaction (v2 path).
 * Without seatClasses the legacy single-row create is used (backward compat).
 *
 * @param {Object}  data             - Flight fields passed from the controller.
 * @param {Array}   [data.seatClasses] - Optional cabin-class array: [{ seatClass, price, totalSeats }].
 * @returns {Promise<Flight>} The newly created Flight instance.
 */
async function createFlight(data){
    try{
        if(compareTime(data.departureTime, data.arrivalTime)){
            throw new AppError('Departure time must be before arrival time', StatusCodes.BAD_REQUEST);
        }
        const flight = data.seatClasses
            ? await flightRepository.createFlightWithClasses(data)
            : await flightRepository.create(data);
        return flight;
    }catch(error){
        if(error instanceof AppError) throw error;
        throw new AppError('Cannot Create a new Flight Object', StatusCodes.INTERNAL_SERVER_ERROR);
    }
}

/**
 * Builds dynamic WHERE and ORDER clauses from URL query parameters, then fetches matching flights.
 *
 * Filters are split into two buckets:
 *  - flightFilter : conditions applied on the Flights table (trips, tripDate).
 *  - classFilter  : conditions applied on the FlightClasses table (price, travellers/seats).
 *    When classFilter is non-empty only flights that have at least one matching FlightClass row
 *    are returned (INNER JOIN behaviour in the repository).
 *
 * Supported query params:
 *  - trips      : "BOM-DEL"           → departureAirportId / arrivalAirportId exact match.
 *  - price      : "500-2000"          → BETWEEN on FlightClasses.price; open ranges supported.
 *  - travellers : "3"                 → FlightClasses.totalSeats >= N.
 *  - tripDate   : "2026-04-15"        → Flights departing on this calendar day.
 *  - sort       : "price_ASC,departureTime_DESC" → comma-separated column_DIRECTION pairs.
 *
 * @param {Object} filters - Parsed req.query object from Express.
 * @returns {Promise<Flight[]>} Array of matching Flight instances with nested associations.
 */
async function getAllFlights(filters){
    let flightFilterConditions = [];
    let classFilterConditions = [];
    let sortFilter = [];
    const endingTripTime = "23:59:59";

    if(filters.trips){
        const [departureAirportId, arrivalAirportId] = filters.trips.split("-");
        if(departureAirportId == arrivalAirportId){
            throw new AppError('Departure and arrival airport cannot be the same', StatusCodes.BAD_REQUEST);
        }
        flightFilterConditions.push(eq(flights.departureAirportId, departureAirportId));
        flightFilterConditions.push(eq(flights.arrivalAirportId, arrivalAirportId));
    }

    if(filters.price){
        const [minPrice, maxPrice] = filters.price.split("-");
        classFilterConditions.push(between(
            flightClasses.price,
            minPrice === '' ? 0 : Number(minPrice),
            maxPrice === undefined ? 1000000 : Number(maxPrice)
        ));
    }

    if(filters.travellers){
        classFilterConditions.push(gte(flightClasses.totalSeats, Number(filters.travellers)));
    }

    if(filters.seatClass){
        classFilterConditions.push(eq(flightClasses.seatClass, filters.seatClass));
    }

    if(filters.stopType){
        flightFilterConditions.push(eq(flights.stopType, filters.stopType));
    }

    if(filters.tripDate){
        const endOfDay = new Date(filters.tripDate + 'T' + endingTripTime);
        const startOfDay = new Date(filters.tripDate);
        const now = new Date();
        const start = startOfDay > now ? startOfDay : now;
        flightFilterConditions.push(between(flights.departureTime, start, endOfDay));
    } else {
        flightFilterConditions.push(gt(flights.departureTime, new Date()));
    }

    if(filters.sort){
        const params = filters.sort.split(",");
        sortFilter = params.map((param) => {
            const [col, dir] = param.split("_");
            return dir === "ASC" ? asc(flights[col]) : desc(flights[col]);
        });
    }

    const flightFilter = flightFilterConditions.length > 0 ? and(...flightFilterConditions) : undefined;
    const classFilter = classFilterConditions.length > 0 ? and(...classFilterConditions) : undefined;

    try {
        const cacheKey = `flights:search:${JSON.stringify(filters, Object.keys(filters).sort())}`;

        try {
            const cached = await Redis.get(cacheKey);
            if(cached) return JSON.parse(cached);
        } catch {
            // Redis down
        }

        const flightsResult = await flightRepository.getAllFlights(flightFilter, classFilter, sortFilter);

        try {
            await Redis.set(cacheKey, JSON.stringify(flightsResult), 'EX', CACHE_TTL);
        } catch {
            // Redis down
        }

        return flightsResult;
    } catch(error) {
        if(error instanceof AppError) throw error;
        throw new AppError('Cannot Fetch data of all the Flights', StatusCodes.INTERNAL_SERVER_ERROR);
    }
}

/**
 * Fetches a single flight by primary key with all associations (Airplane, Airports, Cities,
 * FlightClasses, FlightStops) eager-loaded.
 * Used by the Booking Service to retrieve cabin pricing and availability before booking.
 *
 * @param {number} id - Primary key of the flight to fetch.
 * @returns {Promise<Flight>} The matching Flight instance with nested associations.
 */
async function getFlight(id){
    try {
        const flight = await flightRepository.getFlight(id);
        return flight;
    } catch(error) {
        if(error.statusCode == StatusCodes.NOT_FOUND){
            throw new AppError('The flight you requested is not present', error.statusCode);
        }
        throw new AppError('Cannot Fetch data of the flight', StatusCodes.INTERNAL_SERVER_ERROR);
    }
}

/**
 * Delegates seat count update to the repository, which handles row locking and transactions.
 * Routes to the cabin-class seat update when seatClass is present (v2 bookings), or falls back
 * to the flight-level update for backward compatibility (v1 bookings / direct calls without class).
 *
 * Called by:
 *  - Booking Service PATCH /flights/:id/seats after payment (dec=true) or cancellation (dec=false).
 *  - seat-restoration RabbitMQ subscriber on booking expiry / cancellation.
 *
 * @param {Object}  data           - Update payload.
 * @param {number}  data.flightId  - Primary key of the flight to update.
 * @param {number}  data.seats     - Number of seats to adjust.
 * @param {string}  [data.seatClass] - If present, updates FlightClasses.totalSeats for this cabin.
 * @param {boolean} [data.dec]     - true → decrement (default), false → increment.
 * @returns {Promise<Flight|FlightClass>} The updated instance reflecting the new seat count.
 */
async function updateSeats(data){
    try {
        if(data.seatClass){
            return await flightRepository.updateRemainingClassSeats(
                data.flightId,
                data.seatClass,
                data.seats,
                data.dec
            );
        }
        return await flightRepository.updateRemainingSeats(data.flightId, data.seats, data.dec);
    } catch(error) {
        if(error instanceof AppError) throw error;
        throw new AppError('Cannot update data of the flight', StatusCodes.INTERNAL_SERVER_ERROR);
    }
}

module.exports = {
    createFlight,
    getAllFlights,
    getFlight,
    updateSeats
};
