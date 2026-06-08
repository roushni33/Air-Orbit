const { seats, airplanes } = require('../db/schema');

function generateSeats(airplaneId, totalRows, cols, typeRules) {
    const seatsList = [];
    for (let row = 1; row <= totalRows; row++) {
        const seatType = typeRules.find(rule => row <= rule.upToRow).type;
        for (const col of cols) {
            seatsList.push({
                row,
                col,
                airplaneId,
                type: seatType
            });
        }
    }
    return seatsList;
}

module.exports = async function(db) {
    console.log('Fetching airplanes for seat generation...');
    const planes = await db.select().from(airplanes).orderBy(airplanes.id);
    if (planes.length < 4) {
        throw new Error('Not enough airplanes found to generate seats. Expected 4.');
    }

    console.log('Generating seats...');
    const NARROW_BODY = ['A', 'B', 'C', 'D', 'E', 'F'];
    const WIDE_BODY_9 = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
    const WIDE_BODY_10 = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

    // AIRBUS320 — 30 rows × 6 cols = 180 seats
    const airbus320Seats = generateSeats(planes[0].id, 30, NARROW_BODY, [
        { upToRow: 2,  type: 'first-class' },
        { upToRow: 7,  type: 'business' },
        { upToRow: 12, type: 'premium-economy' },
        { upToRow: 30, type: 'economy' }
    ]);

    // BOEING777 — 44 rows × 9 cols = 396 seats
    const boeing777Seats = generateSeats(planes[1].id, 44, WIDE_BODY_9, [
        { upToRow: 3,  type: 'first-class' },
        { upToRow: 10, type: 'business' },
        { upToRow: 18, type: 'premium-economy' },
        { upToRow: 44, type: 'economy' }
    ]);

    // AIRBUS380 — 56 rows × 10 cols = 560 seats
    const airbus380Seats = generateSeats(planes[2].id, 56, WIDE_BODY_10, [
        { upToRow: 4,  type: 'first-class' },
        { upToRow: 12, type: 'business' },
        { upToRow: 22, type: 'premium-economy' },
        { upToRow: 56, type: 'economy' }
    ]);

    // BOEING737 — 27 rows × 6 cols = 162 seats
    const boeing737Seats = generateSeats(planes[3].id, 27, NARROW_BODY, [
        { upToRow: 2,  type: 'first-class' },
        { upToRow: 6,  type: 'business' },
        { upToRow: 10, type: 'premium-economy' },
        { upToRow: 27, type: 'economy' }
    ]);

    const allSeats = [
        ...airbus320Seats,
        ...boeing777Seats,
        ...airbus380Seats,
        ...boeing737Seats
    ];

    console.log(`Inserting ${allSeats.length} seats...`);
    const SEATS_BATCH_SIZE = 1000;
    for (let i = 0; i < allSeats.length; i += SEATS_BATCH_SIZE) {
        await db.insert(seats).values(allSeats.slice(i, i + SEATS_BATCH_SIZE));
    }
};
