const { Pool } = require('pg');

let poolPromise = null;
let connector = null;

// [DATABASE] Koneksyon sa PostgreSQL: Cloud SQL connector kapag naka-deploy, DATABASE_URL kapag local
async function createPool() {
  if (process.env.INSTANCE_CONNECTION_NAME) {
    const { Connector, IpAddressTypes } = require('@google-cloud/cloud-sql-connector');
    connector = new Connector();
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
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}

// [DATABASE] Parameterized queries ($1, $2...) ang gamit sa lahat ng routes para iwas SQL injection
module.exports = {
  query: (...args) => getPool().then((pool) => pool.query(...args)),
  connect: () => getPool().then((pool) => pool.connect()),
  end: async () => {
    const pool = await getPool();
    await pool.end();
    if (connector) connector.close();
  },
};
