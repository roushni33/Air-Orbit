const { pgTable, serial, integer, varchar, pgEnum, timestamp } = require('drizzle-orm/pg-core');
const { relations } = require('drizzle-orm');
const { ENUMS } = require('../utils/common');
const { BUSINESS, ECONOMY, PREMIUM_ECONOMY, FIRST_CLASS } = ENUMS.SEAT_TYPE;

const seatTypeEnum = pgEnum('seat_type', [BUSINESS, ECONOMY, PREMIUM_ECONOMY, FIRST_CLASS]);
const stopTypeEnum = pgEnum('stop_type', ['DIRECT', 'ONE_STOP']);
const flightClassEnum = pgEnum('flight_class_type', [ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST_CLASS]);

const cities = pgTable('cities', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

const airports = pgTable('airports', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  code: varchar('code', { length: 255 }).notNull().unique(),
  address: varchar('address', { length: 255 }).unique(),
  cityId: integer('city_id').notNull().references(() => cities.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

const airplanes = pgTable('airplanes', {
  id: serial('id').primaryKey(),
  modelNumber: varchar('model_number', { length: 255 }).notNull(),
  capacity: integer('capacity').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

const seats = pgTable('seats', {
  id: serial('id').primaryKey(),
  row: integer('row').notNull(),
  col: varchar('col', { length: 255 }).notNull(),
  airplaneId: integer('airplane_id').notNull().references(() => airplanes.id, { onDelete: 'cascade' }),
  type: seatTypeEnum('type').default(ECONOMY).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

const flights = pgTable('flights', {
  id: serial('id').primaryKey(),
  flightNumber: varchar('flight_number', { length: 255 }).notNull(),
  airplaneId: integer('airplane_id').notNull().references(() => airplanes.id, { onDelete: 'cascade' }),
  departureAirportId: varchar('departure_airport_id', { length: 255 }).notNull(), // code
  arrivalAirportId: varchar('arrival_airport_id', { length: 255 }).notNull(), // code
  arrivalTime: timestamp('arrival_time').notNull(),
  departureTime: timestamp('departure_time').notNull(),
  price: integer('price').notNull(),
  boardingGate: varchar('boarding_gate', { length: 255 }),
  totalSeats: integer('total_seats').notNull(),
  stopType: stopTypeEnum('stop_type').default('DIRECT').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

const flightClasses = pgTable('flight_classes', {
  id: serial('id').primaryKey(),
  flightId: integer('flight_id').notNull().references(() => flights.id, { onDelete: 'cascade' }),
  seatClass: flightClassEnum('seat_class').notNull(),
  price: integer('price').notNull(),
  totalSeats: integer('total_seats').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

const flightStops = pgTable('flight_stops', {
  id: serial('id').primaryKey(),
  flightId: integer('flight_id').notNull().references(() => flights.id, { onDelete: 'cascade' }),
  airportCode: varchar('airport_code', { length: 255 }).notNull(),
  arrivalTime: timestamp('arrival_time').notNull(),
  departureTime: timestamp('departure_time').notNull(),
  layoverMins: integer('layover_mins').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Relations
const citiesRelations = relations(cities, ({ many }) => ({
  airports: many(airports)
}));

const airportsRelations = relations(airports, ({ one }) => ({
  city: one(cities, {
    fields: [airports.cityId],
    references: [cities.id]
  })
}));

const airplanesRelations = relations(airplanes, ({ many }) => ({
  flights: many(flights),
  seats: many(seats)
}));

const flightsRelations = relations(flights, ({ one, many }) => ({
  airplaneDetails: one(airplanes, {
    fields: [flights.airplaneId],
    references: [airplanes.id]
  }),
  departureAirport: one(airports, {
    fields: [flights.departureAirportId],
    references: [airports.code]
  }),
  arrivalAirport: one(airports, {
    fields: [flights.arrivalAirportId],
    references: [airports.code]
  }),
  FlightClasses: many(flightClasses),
  FlightStops: many(flightStops)
}));

const flightClassesRelations = relations(flightClasses, ({ one }) => ({
  flight: one(flights, {
    fields: [flightClasses.flightId],
    references: [flights.id]
  })
}));

const flightStopsRelations = relations(flightStops, ({ one }) => ({
  flight: one(flights, {
    fields: [flightStops.flightId],
    references: [flights.id]
  })
}));

module.exports = {
  seatTypeEnum,
  stopTypeEnum,
  flightClassEnum,
  cities,
  airports,
  airplanes,
  seats,
  flights,
  flightClasses,
  flightStops,
  citiesRelations,
  airportsRelations,
  airplanesRelations,
  flightsRelations,
  flightClassesRelations,
  flightStopsRelations
};
