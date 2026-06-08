const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), override: true });

const db = require('../db');
const { airplanes, cities, airports, flights, flightClasses, seats, flightStops } = require('../db/schema');

const seedAirplanes = require('./add-airplanes');
const seedSeats = require('./add-seats');
const generateFlights = require('./generate-flights');

async function seed() {
    try {
        console.log('Cleaning database...');
        await db.delete(flightClasses);
        await db.delete(flightStops);
        await db.delete(flights);
        await db.delete(seats);
        await db.delete(airports);
        await db.delete(cities);
        await db.delete(airplanes);

        console.log('Running seeder 1: Add Airplanes...');
        await seedAirplanes(db);

        console.log('Running seeder 2: Add Seats...');
        await seedSeats(db);

        console.log('Running seeder 3: Generate Flights...');
        await generateFlights(db);

        console.log('Seeding complete!');
        process.exit(0);
    } catch (e) {
        console.error('Seeding failed:', e);
        process.exit(1);
    }
}

seed();
