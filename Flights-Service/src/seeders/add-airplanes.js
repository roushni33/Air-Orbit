const { airplanes, cities, airports } = require('../db/schema');

module.exports = async function(db) {
    console.log('Seeding airplanes...');
    const planes = await db.insert(airplanes).values([
        { modelNumber: 'AIRBUS320', capacity: 180 },
        { modelNumber: 'BOEING777', capacity: 396 },
        { modelNumber: 'AIRBUS380', capacity: 555 },
        { modelNumber: 'BOEING737', capacity: 160 }
    ]).returning();

    console.log('Seeding initial cities...');
    const cityRows = await db.insert(cities).values([
        { name: 'Mumbai' },
        { name: 'Delhi' },
        { name: 'Bengaluru' },
        { name: 'Chennai' }
    ]).returning();

    const cityMap = {};
    for (const c of cityRows) cityMap[c.name] = c.id;

    console.log('Seeding initial airports...');
    await db.insert(airports).values([
        { name: 'Chhatrapati Shivaji Maharaj International Airport', code: 'BOM', address: 'Mumbai', cityId: cityMap['Mumbai'] },
        { name: 'Indira Gandhi International Airport', code: 'DEL', address: 'New Delhi', cityId: cityMap['Delhi'] },
        { name: 'Kempegowda International Airport', code: 'BLR', address: 'Bengaluru', cityId: cityMap['Bengaluru'] },
        { name: 'Chennai International Airport', code: 'MAA', address: 'Chennai', cityId: cityMap['Chennai'] }
    ]);

    return planes;
};
