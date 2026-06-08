const { airplanes, cities, airports, flights, flightClasses, flightStops } = require('../db/schema');

module.exports = async function(db) {
    const planes = await db.select().from(airplanes).orderBy(airplanes.id);
    if (planes.length < 4) {
        throw new Error('Not enough airplanes found to generate flights. Expected 4.');
    }

    console.log('Seeding additional cities...');
    const cityRows = await db.insert(cities).values([
        { name: 'Hyderabad' },
        { name: 'Kochi' },
        { name: 'Kolkata' },
        { name: 'Ahmedabad' },
        { name: 'Jaipur' },
        { name: 'Pune' }
    ]).returning();

    // Fetch all cities to construct complete city map
    const allCities = await db.select().from(cities);
    const cityMap = {};
    for (const c of allCities) cityMap[c.name] = c.id;

    console.log('Seeding additional airports...');
    await db.insert(airports).values([
        { name: 'Rajiv Gandhi International Airport', code: 'HYD', address: 'Hyderabad', cityId: cityMap['Hyderabad'] },
        { name: 'Cochin International Airport', code: 'COK', address: 'Kochi', cityId: cityMap['Kochi'] },
        { name: 'Netaji Subhas Chandra Bose International Airport', code: 'CCU', address: 'Kolkata', cityId: cityMap['Kolkata'] },
        { name: 'Sardar Vallabhbhai Patel International Airport', code: 'AMD', address: 'Ahmedabad', cityId: cityMap['Ahmedabad'] },
        { name: 'Jaipur International Airport', code: 'JAI', address: 'Jaipur', cityId: cityMap['Jaipur'] },
        { name: 'Pune Airport', code: 'PNQ', address: 'Pune', cityId: cityMap['Pune'] }
    ]);

    console.log('Generating and seeding flights (180 days)...');
    const SEAT_CLASSES = ['economy', 'premium-economy', 'business', 'first-class'];

    const CLASS_PRICE_MULTIPLIER = {
        'economy':         1.0,
        'premium-economy': 1.8,
        'business':        3.5,
        'first-class':     6.5,
    };

    const AIRPLANE_CLASS_SEATS = {
        [planes[0].id]: { 'economy': 144, 'premium-economy': 24, 'business': 12, 'first-class':  0 },
        [planes[1].id]: { 'economy': 300, 'premium-economy': 52, 'business': 36, 'first-class':  8 },
        [planes[2].id]: { 'economy': 420, 'premium-economy': 76, 'business': 48, 'first-class': 11 },
        [planes[3].id]: { 'economy': 132, 'premium-economy': 18, 'business': 10, 'first-class':  0 },
    };

    const DURATION_MAP = {
        'BOM-DEL': 130, 'BOM-BLR': 105, 'BOM-MAA': 135, 'BOM-HYD':  90, 'BOM-COK': 150,
        'BOM-CCU': 170, 'BOM-AMD':  65, 'BOM-JAI': 110, 'BOM-PNQ':  40,
        'DEL-BLR': 165, 'DEL-MAA': 180, 'DEL-HYD': 140, 'DEL-COK': 195, 'DEL-CCU': 130,
        'DEL-AMD':  95, 'DEL-JAI':  60, 'DEL-PNQ': 150,
        'BLR-MAA':  60, 'BLR-HYD':  75, 'BLR-COK':  90, 'BLR-CCU': 175, 'BLR-AMD': 155,
        'BLR-JAI': 195, 'BLR-PNQ': 135,
        'MAA-HYD':  80, 'MAA-COK':  80, 'MAA-CCU': 165, 'MAA-AMD': 165, 'MAA-JAI': 195,
        'MAA-PNQ': 140,
        'HYD-COK': 105, 'HYD-CCU': 155, 'HYD-AMD': 130, 'HYD-JAI': 165, 'HYD-PNQ':  90,
        'COK-CCU': 190, 'COK-AMD': 170, 'COK-JAI': 210, 'COK-PNQ': 155,
        'CCU-AMD': 185, 'CCU-JAI': 185, 'CCU-PNQ': 175,
        'AMD-JAI':  50, 'AMD-PNQ':  70,
        'JAI-PNQ': 130,
    };

    const ALL_AIRPORTS = ['BOM', 'DEL', 'BLR', 'MAA', 'HYD', 'COK', 'CCU', 'AMD', 'JAI', 'PNQ'];

    const DEPARTURE_TIMES = [
        { hours:  6, mins:  0 },
        { hours:  7, mins: 30 },
        { hours:  9, mins:  0 },
        { hours: 10, mins: 30 },
        { hours: 12, mins:  0 },
        { hours: 13, mins: 30 },
        { hours: 15, mins:  0 },
        { hours: 16, mins: 30 },
        { hours: 18, mins:  0 },
        { hours: 19, mins: 30 },
    ];

    const CARRIERS  = ['6E', 'AI', 'SG', 'UK', 'IX', 'G8', 'QP', 'I5'];
    const AIRPLANE_IDS = [planes[0].id, planes[1].id, planes[2].id, planes[3].id];

    function buildRoutes() {
        const routes = [];
        for (const [key, durationMins] of Object.entries(DURATION_MAP)) {
            const [from, to] = key.split('-');
            routes.push({ from, to, durationMins });
            routes.push({ from: to, to: from, durationMins });
        }
        return routes; // 90 entries
    }

    function flightNumber(routeIdx, timeIdx, dayIdx) {
        const carrier = CARRIERS[(routeIdx + timeIdx) % CARRIERS.length];
        const num = String(((routeIdx * 10 + timeIdx) * 13 + dayIdx) % 9000 + 1000);
        return `${carrier}${num}`;
    }

    function baseEconomyPrice(durationMins, routeIdx, timeIdx, dayIdx) {
        const base      = 1500 + durationMins * 12;
        const variation = (routeIdx * 113 + timeIdx * 57 + dayIdx * 7) % 3000;
        return Math.round(base + variation);
    }

    function availFactor(routeIdx, timeIdx) {
        const hash = (routeIdx * 3 + timeIdx) % 5;
        if (hash === 0) return 0.12; // ~12% left
        if (hash === 1) return 0.45; // ~45% left
        return 1.0;
    }

    const ROUTES = buildRoutes();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const BATCH = 1000;

    for (let day = 0; day < 180; day++) {
        const date = new Date(today);
        date.setDate(date.getDate() + day);

        const flightRows = [];
        const meta = [];

        for (let routeIdx = 0; routeIdx < ROUTES.length; routeIdx++) {
            const route = ROUTES[routeIdx];
            const isOneStop = route.durationMins > 100 && routeIdx % 3 === 0;
            const airplaneId = AIRPLANE_IDS[(routeIdx + day) % AIRPLANE_IDS.length];

            let stopAirportCode = null;
            if (isOneStop) {
                const eligible = ALL_AIRPORTS.filter(a => a !== route.from && a !== route.to);
                stopAirportCode = eligible[(routeIdx * 7) % eligible.length];
            }

            for (let timeIdx = 0; timeIdx < DEPARTURE_TIMES.length; timeIdx++) {
                const slot = DEPARTURE_TIMES[timeIdx];
                const basePrice = baseEconomyPrice(route.durationMins, routeIdx, timeIdx, day);
                const layoverMins = isOneStop ? (35 + timeIdx * 5) : 0;

                const departureTime = new Date(date);
                departureTime.setHours(slot.hours, slot.mins, 0, 0);

                const arrivalTime = new Date(departureTime);
                arrivalTime.setMinutes(arrivalTime.getMinutes() + route.durationMins + layoverMins);

                flightRows.push({
                    flightNumber: flightNumber(routeIdx, timeIdx, day),
                    airplaneId,
                    departureAirportId: route.from,
                    arrivalAirportId: route.to,
                    departureTime,
                    arrivalTime,
                    price: basePrice,
                    totalSeats: AIRPLANE_CLASS_SEATS[airplaneId]['economy'],
                    boardingGate: 'SEED',
                    stopType: isOneStop ? 'ONE_STOP' : 'DIRECT',
                });

                meta.push({ routeIdx, timeIdx, airplaneId, basePrice, isOneStop, stopAirportCode, layoverMins, departureTime, route });
            }
        }

        // Insert flights in batches and retrieve their generated IDs
        const insertedFlights = [];
        for (let i = 0; i < flightRows.length; i += BATCH) {
            const chunk = flightRows.slice(i, i + BATCH);
            const returned = await db.insert(flights).values(chunk).returning({ id: flights.id });
            insertedFlights.push(...returned);
        }

        const flightClassesRows = [];
        const flightStopsRows = [];

        for (let i = 0; i < insertedFlights.length; i++) {
            const flightId = insertedFlights[i].id;
            const m = meta[i];
            const classCaps = AIRPLANE_CLASS_SEATS[m.airplaneId];
            const factor = availFactor(m.routeIdx, m.timeIdx);

            for (const seatClass of SEAT_CLASSES) {
                const capacity = classCaps[seatClass];
                if (!capacity) continue;

                flightClassesRows.push({
                    flightId,
                    seatClass,
                    price: Math.round(m.basePrice * CLASS_PRICE_MULTIPLIER[seatClass]),
                    totalSeats: Math.max(1, Math.floor(capacity * factor)),
                });
            }

            if (m.isOneStop) {
                const stopArrival = new Date(m.departureTime);
                stopArrival.setMinutes(stopArrival.getMinutes() + Math.floor(m.route.durationMins / 2));

                const stopDeparture = new Date(stopArrival);
                stopDeparture.setMinutes(stopDeparture.getMinutes() + m.layoverMins);

                flightStopsRows.push({
                    flightId,
                    airportCode: m.stopAirportCode,
                    arrivalTime: stopArrival,
                    departureTime: stopDeparture,
                    layoverMins: m.layoverMins,
                });
            }
        }

        // Insert flight classes and stops in batches
        for (let i = 0; i < flightClassesRows.length; i += BATCH) {
            await db.insert(flightClasses).values(flightClassesRows.slice(i, i + BATCH));
        }
        for (let i = 0; i < flightStopsRows.length; i += BATCH) {
            await db.insert(flightStops).values(flightStopsRows.slice(i, i + BATCH));
        }

        if (day % 30 === 0) {
            console.log(`  Seeded day ${day}/179...`);
        }
    }
};
