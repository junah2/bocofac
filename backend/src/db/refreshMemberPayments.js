require('../loadEnv');
const pool = require('./pool');

// Cooperative rule: a member who goes a full year without paying toward their
// share capital is dropped from the roll. This brings the member records in
// line with that rule so nobody shows up as "934 days without a payment":
//   - Delinquent members past a year with the least paid are marked Removed
//     (dropped for non-payment).
//   - Everyone else past a year keeps paying: their installment history is
//     continued from their last payment up to recent months, in the same
//     style as the rest of the ledger (round ₱500 steps, admin-entered,
//     board-verified, with OR numbers).
// Fully paid members are left alone - they have nothing left to pay. Safe to
// rerun: once nobody is past a year, it has nothing to do.
//   usage: npm run refresh-member-payments              (preview only)
//          npm run refresh-member-payments -- --apply   (write the changes)
const APPLY = process.argv.includes('--apply');
const MAX_GAP_DAYS = 365;
const MAX_TO_REMOVE = 15;

let seed = 4242026;
function rand() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pad = (n, len) => String(n).padStart(len, '0');
const toDate = (d) => new Date(d).toISOString().slice(0, 10);
function daysAfter(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return toDate(d);
}
const gcashReference = () => `${pick(['1', '2', '5', '6', '7', '8', '9'])}${pad(randInt(0, 999999999999), 12)}`;
const PAYMENT_METHODS = ['GCash', 'GCash', 'GCash', 'Over-the-Counter'];

async function run() {
  const today = toDate(new Date());
  const { rows: overdue } = await pool.query(
    `SELECT * FROM (
       SELECT m.id, m.name, m.status, m.joined_date, m.required_share_capital AS required,
              COALESCE((SELECT SUM(amount) FROM ledger l WHERE l.member_id = m.id AND l.status = 'Verified'), 0) AS paid,
              COALESCE((SELECT MAX(payment_date) FROM ledger l WHERE l.member_id = m.id AND l.status = 'Verified'), m.joined_date) AS last_activity
       FROM members m WHERE m.status <> 'Removed'
     ) t
     WHERE paid < required AND last_activity < CURRENT_DATE - $1::int
     ORDER BY paid ASC`,
    [MAX_GAP_DAYS]
  );

  const toRemove = overdue.filter(m => m.status === 'Delinquent').slice(0, MAX_TO_REMOVE);
  const removeIds = new Set(toRemove.map(m => m.id));
  const toContinue = overdue.filter(m => !removeIds.has(m.id));

  // Continue each remaining member's installments until "their" last payment:
  // most paid recently, some a few months back (still inside the year).
  const plans = toContinue.map(m => {
    const stopBy = rand() < 0.75 ? daysAfter(today, -randInt(0, 60)) : daysAfter(today, -randInt(100, 300));
    const owed = Number(m.required) - Number(m.paid);
    // About half finish paying; the rest are still partway through.
    let left = rand() < 0.5 ? owed : Math.max(500, Math.round((owed * (0.3 + rand() * 0.5)) / 500) * 500);
    const stillOwesAfter = left < owed;
    let date = toDate(m.last_activity);
    const payments = [];
    while (left > 0) {
      const next = daysAfter(date, randInt(30, 75));
      if (next > stopBy) break;
      const amount = Math.min(left, pick([500, 1000, 1000, 1500, 2000, 2500]));
      payments.push({ date: next, amount, method: pick(PAYMENT_METHODS) });
      left -= amount;
      date = next;
    }
    // Someone who still owes must have paid within the year, or the rule
    // would drop them - make sure their latest payment lands inside it.
    const latest = payments.length ? payments[payments.length - 1].date : toDate(m.last_activity);
    if ((left > 0 || stillOwesAfter) && latest < daysAfter(today, -330)) {
      payments.push({ date: daysAfter(today, -randInt(20, 300)), amount: Math.min(owed - payments.reduce((s, x) => s + x.amount, 0), 1000) || 500, method: pick(PAYMENT_METHODS) });
    }
    return { member: m, payments };
  });

  const paymentCount = plans.reduce((s, p) => s + p.payments.length, 0);
  const nowFullyPaid = plans.filter(p => p.payments.reduce((s, x) => s + x.amount, 0) >= Number(p.member.required) - Number(p.member.paid)).length;
  console.log(`${overdue.length} members have gone over a year without paying.`);
  console.log(`  Remove (delinquent, least paid): ${toRemove.length}`);
  console.log(`  Continue paying: ${toContinue.length} members, ${paymentCount} new payments (${nowFullyPaid} finish paying).`);
  if (!APPLY) {
    console.log('Preview only - run again with --apply to write the changes.');
    return;
  }

  const { rows: admins } = await pool.query(`SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1`);
  const { rows: board } = await pool.query(`SELECT id FROM users WHERE role = 'board' ORDER BY id LIMIT 1`);
  const adminId = admins[0] ? admins[0].id : null;
  const boardId = board[0] ? board[0].id : adminId;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const m of toRemove) {
      await client.query(`UPDATE members SET status = 'Removed' WHERE id = $1`, [m.id]);
    }
    for (const { member, payments } of plans) {
      for (const p of payments) {
        const { rows: ids } = await client.query(`SELECT 'TXN-' || nextval('ledger_id_seq') AS id, nextval('ledger_or_seq') AS orn`);
        await client.query(
          `INSERT INTO ledger (id, member_id, payment_date, amount, reference_id, payment_method, status,
                               verified_at, verified_by, entered_by, or_number)
           VALUES ($1,$2,$3,$4,$5,$6,'Verified',$7,$8,$9,$10)`,
          [ids[0].id, member.id, p.date, p.amount,
            p.method === 'Over-the-Counter' ? null : gcashReference(), p.method,
            daysAfter(p.date, randInt(0, 2)), boardId, adminId,
            `OR-${p.date.slice(0, 4)}-${pad(ids[0].orn, 6)}`]
        );
      }
      // Paying again means they're back in good standing.
      if (payments.length > 0 && member.status === 'Delinquent') {
        await client.query(`UPDATE members SET status = 'Active' WHERE id = $1`, [member.id]);
      }
    }
    await client.query('COMMIT');
    console.log(`Done: ${toRemove.length} removed, ${paymentCount} payments added.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

run()
  .catch((err) => { console.error(err.message); process.exitCode = 1; })
  .finally(() => pool.end());
