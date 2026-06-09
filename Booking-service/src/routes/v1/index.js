/*
 * V1 API router.
 *
 * Registers all resource-level routers for version 1 of the API.
 *
 * Current routes:
 *   /api/v1/booking  →  bookingRoutes
 */

const express = require('express');


const bookingRoutes = require('./booking');
const router = express.Router()


router.use('/health', (req, res) => {
    res.json({
        'service': 'Air Orbit Booking Service',
        'statusCode': 200,
        'health': 'Good'
    })
})

router.use('/booking', bookingRoutes);

 
module.exports = router;