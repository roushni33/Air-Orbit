const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const schema = require('./schema');
const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSL } = process.env;

const sslConfig = DB_SSL === 'true' ? {
    rejectUnauthorized: false
} : undefined;

const pool = new Pool({
    host: DB_HOST,
    port: parseInt(DB_PORT) || 5432,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    ssl: sslConfig
});

const db = drizzle(pool, { schema });

module.exports = db;
