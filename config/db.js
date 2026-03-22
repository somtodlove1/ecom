// config/db.js
const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

const config = {
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

if (connectionString) {
  config.connectionString = connectionString;
  // If connecting to external Render DB, require SSL
  if (connectionString.includes('render.com')) {
    config.ssl = { rejectUnauthorized: false };
  }
} else {
  // Fallback for local connection if DATABASE_URL is not set
  config.host = process.env.DB_HOST || 'localhost';
  config.user = process.env.DB_USER || 'postgres';
  config.password = process.env.DB_PASSWORD || '';
  config.database = process.env.DB_NAME || 'ecommerce_db';
  config.port = process.env.DB_PORT || 5432;
}

const pool = new Pool(config);

module.exports = pool;
