require('../loadEnv');
const fs = require('fs');
const path = require('path');
const pool = require('./pool');
const { nextProductId } = require('../utils/ids');

// [DATABASE] Pinapalitan ang lumang sales history (HIST-*) ng laman ng sales-history.csv.
// Hindi ginagalaw ang mga totoong order galing sa system (ORD-*).
// Gamit: npm run import-sales            -> i-save sa database
//        npm run import-sales -- --dry-run -> silipin lang, walang mase-save

const DRY_RUN = process.argv.includes('--dry-run');
const CSV_PATH = path.join(__dirname, 'sales-history.csv');
const HISTORY_BUYER = 'Historical Sales Import';
const HISTORY_EMAIL = 'historical-import@bocofac.local';

const NO_PHOTO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='100%25' height='100%25' fill='%23e2e8f0'/%3E%3Ctext x='50%25' y='50%25' font-size='20' text-anchor='middle' fill='%2394a3b8' font-family='sans-serif' dy='.3em'%3ENo Photo%3C/text%3E%3C/svg%3E";

// Kapalit na pangalan kapag wala sa database ang eksaktong pangalan sa Excel
const NAME_ALIASES = {
  'Coconut Rope': 'Coconut Rope (12m)',
  'Coconut Wood Spatula': 'Coconut Shell Spatula',
  'Coconut Shell Ladle': 'Coconut Shell Sandok (Large)',
};

// Iisang "Coconut Husk Pole" lang sa Excel; ang presyo ang nagsasabi kung anong haba
const HUSK_POLE_BY_PRICE = {
  35: 'Coconut Husk Pole (1 ft)',
  50: 'Coconut Husk Pole (2 ft)',
  65: 'Coconut Husk Pole (3 ft)',
  80: 'Coconut Husk Pole (4 ft)',
};

// Wala pa sa database; gagawin ng script kung wala pa
const NEW_PRODUCTS = [
  {
    name: 'Coconut Shell Small Spoon',
    category: 'Handicraft',
    description: 'Small handcrafted spoon made from coconut shell.',
    price: 75,
    unit: 'Piece',
  },
];

const normalize = (name) => name.trim().toLowerCase();

function readSales() {
  const lines = fs.readFileSync(CSV_PATH, 'utf8').trim().split(/\r?\n/).slice(1);
  return lines.map((line, i) => {
    const [product, quantity, unitPrice, totalAmount, orderedDate] = line.split(',');
    const row = {
      line: i + 2,
      product: product.trim(),
      quantity: Number(quantity),
      unitPrice: Number(unitPrice),
      totalAmount: Number(totalAmount),
      orderedDate: orderedDate.trim(),
    };
    if (!row.product || !(row.quantity > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(row.orderedDate)) {
      throw new Error(`sales-history.csv line ${row.line}: invalid row "${line}"`);
    }
    if (row.quantity * row.unitPrice !== row.totalAmount) {
      throw new Error(`sales-history.csv line ${row.line}: quantity x price != total`);
    }
    return row;
  });
}

// Eksaktong pangalan muna; alias lang kung wala ito sa database
function findProduct(row, productsByName) {
  if (row.product === 'Coconut Husk Pole') {
    const name = HUSK_POLE_BY_PRICE[row.unitPrice];
    if (!name) throw new Error(`sales-history.csv line ${row.line}: unknown husk pole price ${row.unitPrice}`);
    return productsByName.get(normalize(name));
  }
  return productsByName.get(normalize(row.product))
    || (NAME_ALIASES[row.product] && productsByName.get(normalize(NAME_ALIASES[row.product])));
}

async function importSales() {
  const sales = readSales().sort((a, b) => a.orderedDate.localeCompare(b.orderedDate) || a.line - b.line);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: products } = await client.query('SELECT id, name FROM products');
    const productsByName = new Map(products.map((p) => [normalize(p.name), p]));

    for (const np of NEW_PRODUCTS) {
      if (productsByName.has(normalize(np.name))) continue;
      const firstSale = sales.find((s) => s.product === np.name);
      const id = await nextProductId(client);
      // [DATABASE] created_at = petsa ng unang benta para hindi ma-flag na "bagong product"
      await client.query(
        `INSERT INTO products (id, name, category, description, price, stock, unit, image, created_at)
         VALUES ($1,$2,$3,$4,$5,0,$6,$7,$8)`,
        [id, np.name, np.category, np.description, np.price, np.unit, NO_PHOTO, firstSale ? `${firstSale.orderedDate}T12:00:00+08:00` : new Date()]
      );
      productsByName.set(normalize(np.name), { id, name: np.name });
      console.log(`Created product ${id} - ${np.name}`);
    }

    const unmatched = new Set();
    const resolved = sales.map((s) => {
      const product = findProduct(s, productsByName);
      if (!product) unmatched.add(s.product);
      return { ...s, product };
    });
    if (unmatched.size) {
      throw new Error(`No matching product in the database for: ${[...unmatched].join(', ')}`);
    }

    const { rowCount: deleted } = await client.query("DELETE FROM orders WHERE id LIKE 'HIST-%'");

    // [DATABASE] Isang bagsakan ang insert (unnest) para mabilis kahit malayo ang database
    const ids = resolved.map((_, i) => `HIST-${String(i + 1).padStart(6, '0')}`);
    await client.query(
      `INSERT INTO orders (id, buyer_name, buyer_email, total_amount, payment_method, status, ordered_at, channel)
       SELECT id, $2, $3, total, 'Cash', 'Completed', ordered_at, 'walk-in'
       FROM unnest($1::text[], $4::numeric[], $5::timestamptz[]) AS t(id, total, ordered_at)`,
      [
        ids,
        HISTORY_BUYER,
        HISTORY_EMAIL,
        resolved.map((s) => s.totalAmount),
        // Tanghali (PH time) para hindi lumipat ng araw/buwan kahit anong timezone ang browser
        resolved.map((s) => `${s.orderedDate}T12:00:00+08:00`),
      ]
    );
    await client.query(
      `INSERT INTO order_items (order_id, product_id, product_name, price, quantity)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::numeric[], $5::int[])`,
      [
        ids,
        resolved.map((s) => s.product.id),
        resolved.map((s) => s.product.name.trim()),
        resolved.map((s) => s.unitPrice),
        resolved.map((s) => s.quantity),
      ]
    );

    // [DATABASE] Bilangin ulit ang "sold" ng bawat product mula sa mismong mga order
    // (hindi kasama ang Rejected/Cancelled, gaya ng sa orders.routes.js)
    await client.query(
      `UPDATE products p SET orders_count = COALESCE((
         SELECT SUM(i.quantity) FROM order_items i JOIN orders o ON o.id = i.order_id
         WHERE i.product_id = p.id AND o.status NOT IN ('Rejected', 'Cancelled')
       ), 0)`
    );

    const total = resolved.reduce((sum, s) => sum + s.totalAmount, 0);
    console.log(`Removed ${deleted} old historical orders.`);
    console.log(`Imported ${resolved.length} orders (${resolved[0].orderedDate} to ${resolved[resolved.length - 1].orderedDate}), total PHP ${total.toLocaleString()}.`);

    if (DRY_RUN) {
      await client.query('ROLLBACK');
      console.log('Dry run - nothing was saved.');
    } else {
      await client.query('COMMIT');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

importSales().catch((err) => {
  console.error('Sales import failed:', err.message);
  process.exit(1);
});
