require('dotenv').config();
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect()
  .then(() => {
    console.log('PG_CONNECTED');
    return client.end();
  })
  .catch((err) => {
    console.error('PG_ERROR:', err.message);
    process.exit(1);
  });
