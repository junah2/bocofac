require('../loadEnv');
const pool = require('./pool');
const products = require('./products-snapshot.json');

async function sync() {
  const columns = Object.keys(products[0]);
  const updates = columns.filter((c) => c !== 'id').map((c) => `${c} = EXCLUDED.${c}`).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `INSERT INTO products (${columns.join(', ')}) VALUES (${placeholders})
               ON CONFLICT (id) DO UPDATE SET ${updates}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const product of products) {
      await client.query(sql, columns.map((c) => product[c]));
    }
    const maxNumber = Math.max(...products.map((p) => Number(p.id.replace('prod-', ''))).filter(Number.isFinite));
    await client.query(
      "SELECT setval('product_id_seq', GREATEST((SELECT last_value FROM product_id_seq), $1))",
      [maxNumber]
    );
    await client.query('COMMIT');
    const active = products.filter((p) => p.is_active).length;
    console.log(`Synced ${products.length} products (${active} visible, ${products.length - active} hidden).`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

sync().catch((err) => {
  console.error('Product sync failed:', err);
  process.exit(1);
});
