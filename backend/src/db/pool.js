// protection for sql injection and CONNECTION BACKEND TO  DATABASE
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = pool;
