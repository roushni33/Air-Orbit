const { defineConfig } = require('drizzle-kit');

module.exports = defineConfig({
  schema: './src/db/schema.js',
  out: './src/db/migration',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'localdev',
    database: process.env.DB_NAME || 'FLIGHTS',
    ssl: process.env.DB_SSL === 'true'
  },
});
