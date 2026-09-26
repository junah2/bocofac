// protection for sql injection and CONNECTION BACKEND TO  DATABASE
const { Pool } = require('pg');

// Locally this is a plain DATABASE_URL pool. On Firebase (Cloud Functions),
// INSTANCE_CONNECTION_NAME is set instead and the connection goes through
// Google's Cloud SQL connector, which authenticates with the function's own
// service account - so the database never has to accept connections from the
// open internet. The connector's setup is async, hence the lazily-created
// pool behind the same query/connect/end interface every route already uses.
let poolPromise = null;

async function createPool() {
  if (process.env.INSTANCE_CONNECTION_NAME) {
    const { Connector, IpAddressTypes } = require('@google-cloud/cloud-sql-connector');
    const connector = new Connector();
    const clientOpts = await connector.getOptions({
      instanceConnectionName: process.env.INSTANCE_CONNECTION_NAME,
      ipType: IpAddressTypes.PUBLIC,
    });
    return new Pool({
      ...clientOpts,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      max: 5,
    });
  }
  return new Pool({ connectionString: process.env.DATABASE_URL });
}

function getPool() {
  if (!poolPromise) {
    poolPromise = createPool().catch((err) => {
      poolPromise = null; // let the next request retry instead of caching the failure
      throw err;
    });
  }
  return poolPromise;
}

module.exports = {
  query: (...args) => getPool().then((pool) => pool.query(...args)),
  connect: () => getPool().then((pool) => pool.connect()),
  end: () => getPool().then((pool) => pool.end()),
};
