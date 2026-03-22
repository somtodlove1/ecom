// config/db.js
const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://e_commerce_llwg_user:iRnBj0VXvzO1E6gcqHEGwtnKCUShrhn1@dpg-d6vr5594tr6s73dprk4g-a.singapore-postgres.render.com/e_commerce_llwg';

const config = {
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
};

const pool = new Pool(config);

module.exports = pool;
