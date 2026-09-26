require('../loadEnv');
const fs = require('fs');
const pool = require('./pool');

// Runs a SQL file (e.g. a data export made with pg_dump --column-inserts)
// against whatever database the env points at - locally DATABASE_URL, on
// Cloud Shell the Cloud SQL connector via INSTANCE_CONNECTION_NAME. The file
// is expected to carry its own BEGIN/COMMIT, so a failure part-way through
// rolls everything back instead of leaving the database half-imported.
//   usage: npm run import-sql -- <path/to/file.sql>
async function run() {
  const file = process.argv[2];
  if (!file) {
    throw new Error('Pass the SQL file path, e.g.: npm run import-sql -- ~/bocofac-live-import.sql');
  }
  const sql = fs.readFileSync(file, 'utf8');
  const client = await pool.connect();
  try {
    await client.query(sql);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    client.release(true);
    await pool.end();
    console.error('Import failed (nothing was changed):', err.message);
    process.exit(1);
  }
  // pg_dump output empties the session's search_path, so this connection is
  // discarded rather than returned to the pool for the summary query below.
  client.release(true);

  const counts = await pool.query(`
    SELECT (SELECT count(*) FROM public.users) AS users,
           (SELECT count(*) FROM public.members) AS members,
           (SELECT count(*) FROM public.products) AS products,
           (SELECT count(*) FROM public.orders) AS orders,
           (SELECT count(*) FROM public.ledger) AS ledger,
           (SELECT count(*) FROM public.applicants) AS applicants,
           (SELECT count(*) FROM public.pmes_sessions) AS pmes_sessions`);
  console.log('Import complete:', counts.rows[0]);
  await pool.end();
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
