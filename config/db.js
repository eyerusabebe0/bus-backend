require('dotenv').config({ override: true });

const { Pool } = require('pg');

const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${
    process.env.PGHOST || 'localhost'
  }:${process.env.PGPORT || '5432'}/${process.env.PGDATABASE || 'busticket'}`;

const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

async function testDatabaseConnection() {
  try {
    const result = await pool.query('SELECT NOW() AS current_time');
    console.log('✅ PostgreSQL connected:', result.rows[0].current_time);
    return result.rows[0];
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    throw error;
  }
}

module.exports = {
  pool,
  testDatabaseConnection,
};