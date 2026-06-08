const express = require('express');
const cors = require('cors');
const { PORT } = require('./config/server-config');
const apiRoutes = require('./routes');

const app = express();

// ALLOWED_ORIGIN: set to your Vercel URL in production (e.g. https://air-orbit.vercel.app)
// Falls back to * so local dev and testing work without configuration.
app.use(cors({
    origin: process.env.ALLOWED_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
}));

// Body parsing only applied to /api/v1/auth - routes the Gateway handles directly.
// Proxy routes (/flights, /bookings etc.) must NOT have body parsed here,
// as consuming the stream prevents http-proxy-middleware from forwarding the body.
app.use('/api/v1/auth', express.json());
app.use('/api/v1/auth', express.urlencoded({ extended: true }));

app.use('/api', apiRoutes);

app.listen(PORT, async () => {
    console.log(`API Gateway running on port ${PORT}`);
    // DB connection is now handled lazily by Drizzle on first query
    console.log('DB ready (Drizzle/PostgreSQL)');
});
