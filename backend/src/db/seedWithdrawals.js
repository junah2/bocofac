require('../loadEnv');
const pool = require('./pool');
const { SHARE_CAPITAL_CAP } = require('../utils/shareCapital');

// Fills the withdrawals table with a believable earnings-withdrawal history
// so the Analytics insights (common amounts, money in vs out, approval
// rate) have something real to show. Follows the same rules the app does:
// only fully-paid members earn (10% of share capital a month since joining,
// see withdrawals.routes.js), and nothing sent ever exceeds what a member had
// earned by that date. Deterministic (fixed random seed), so reruns on a
// copy of the same data produce the same history.
//   usage: npm run seed-withdrawals              (preview only, writes nothing)
//          npm run seed-withdrawals -- --apply   (insert the records)
const MONTHLY_RATE = 0.10;
const HISTORY_MONTHS = 10;
const APPLY = process.argv.includes('--apply');

// Round amounts people actually ask for, weighted toward ₱1,000-₱2,000.
const AMOUNTS = [
  [500, 3], [1000, 6], [1500, 5], [2000, 5], [2500, 2], [3000, 2], [5000, 1],
];
const REJECTION_NOTES = [
  'GCash number on file is inactive - please update your mobile number and request again.',
  'Duplicate of an earlier request that was already released.',
  'Requested amount was more than your available earnings at the time of review.',
];

// mulberry32 - tiny seeded PRNG so the generated history is repeatable.
function makeRandom(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = makeRandom(20260928);
const pick = (items) => items[Math.floor(random() * items.length)];
function pickWeighted(pairs) {
  if (pairs.length === 0) return null;
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = random() * total;
  for (const [value, weight] of pairs) { if ((r -= weight) < 0) return value; }
  return pairs[pairs.length - 1][0];
}

function monthsBetween(start, end) {
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

// A weekday in the given month (Philippine office hours, 8am-6pm, +08:00),
// never in the future.
function randomWeekdayIn(year, month, now) {
  for (let tries = 0; tries < 20; tries++) {
    const day = 1 + Math.floor(random() * 28);
    const d = new Date(Date.UTC(year, month, day, Math.floor(random() * 10), Math.floor(random() * 60))); // 8am-6pm PH
    const weekday = new Date(Date.UTC(year, month, day)).getUTCDay();
    if (weekday !== 0 && weekday !== 6 && d < now) return d;
  }
  return null;
}

// Released 1-3 business days after the request, during office hours.
function processedAfter(requestedAt) {
  const d = new Date(requestedAt);
  let businessDays = 1 + Math.floor(random() * 3);
  while (businessDays > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const weekday = d.getUTCDay();
    if (weekday !== 0 && weekday !== 6) businessDays--;
  }
  d.setUTCHours(1 + Math.floor(random() * 8), Math.floor(random() * 60)); // 9am-5pm PH
  return d;
}

const gcashReference = () => `${pick(['5', '6', '7', '8', '9'])}${String(Math.floor(random() * 1e12)).padStart(12, '0')}`;

async function run() {
  const now = new Date();
  const { rows: existing } = await pool.query('SELECT COUNT(*)::int AS n FROM withdrawals');
  if (existing[0].n > 5) {
    console.log(`There are already ${existing[0].n} withdrawal records - not adding more.`);
    return;
  }
  const { rows: admins } = await pool.query(`SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1`);
  const processedBy = admins[0] ? admins[0].id : null;

  const { rows: members } = await pool.query(
    `SELECT m.id, m.name, m.joined_date, m.required_share_capital,
            COALESCE((SELECT SUM(amount) FROM ledger WHERE member_id = m.id AND status = 'Verified'), 0) AS paid,
            COALESCE((SELECT SUM(sent_amount) FROM withdrawals WHERE member_id = m.id AND status = 'Sent'), 0) AS already_sent
     FROM members m WHERE m.status <> 'Removed' ORDER BY m.id`
  );
  const eligible = members.filter(m => {
    const capital = Math.min(Number(m.paid), SHARE_CAPITAL_CAP);
    return Number(m.required_share_capital) > 0 && capital >= Number(m.required_share_capital);
  });

  const records = [];
  for (const m of eligible) {
    const capital = Math.min(Number(m.paid), SHARE_CAPITAL_CAP);
    const joined = new Date(m.joined_date);
    let sent = Number(m.already_sent);
    // Some members withdraw often, some rarely.
    const monthlyChance = pick([0.45, 0.6, 0.75]);
    for (let back = HISTORY_MONTHS - 1; back >= 0; back--) {
      if (random() > monthlyChance) continue;
      const monthStart = new Date(now.getFullYear(), now.getMonth() - back, 1);
      const requestedAt = randomWeekdayIn(monthStart.getFullYear(), monthStart.getMonth(), now);
      if (!requestedAt) continue;
      const earned = capital * MONTHLY_RATE * monthsBetween(joined, requestedAt);
      const available = earned - sent;
      const amount = pickWeighted(AMOUNTS.filter(([a]) => a <= available));
      if (!amount || amount > available) continue;

      const ageDays = (now - requestedAt) / 86400000;
      let status = 'Sent';
      if (ageDays < 4) status = 'Pending';
      else if (random() < 0.15) status = 'Rejected';

      const record = { memberId: m.id, name: m.name, amount, requestedAt, status };
      if (status === 'Sent') {
        record.processedAt = processedAfter(requestedAt);
        if (record.processedAt > now) { record.status = 'Pending'; delete record.processedAt; }
        else { record.reference = gcashReference(); sent += amount; }
      } else if (status === 'Rejected') {
        record.processedAt = processedAfter(requestedAt);
        if (record.processedAt > now) { record.status = 'Pending'; delete record.processedAt; }
        else record.note = pick(REJECTION_NOTES);
      }
      records.push(record);
    }
  }
  records.sort((a, b) => a.requestedAt - b.requestedAt);

  const count = (s) => records.filter(r => r.status === s).length;
  console.log(`${eligible.length} fully paid members eligible. ${records.length} withdrawals: ${count('Sent')} sent, ${count('Rejected')} rejected, ${count('Pending')} pending.`);
  const byAmount = {};
  records.forEach(r => { byAmount[r.amount] = (byAmount[r.amount] || 0) + 1; });
  console.log('By amount:', Object.entries(byAmount).map(([a, n]) => `₱${Number(a).toLocaleString()} x${n}`).join(', '));

  if (!APPLY) {
    console.log('Preview only - run again with --apply to insert.');
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of records) {
      const { rows } = await client.query(`SELECT 'WD-' || nextval('withdrawal_id_seq') AS id`);
      await client.query(
        `INSERT INTO withdrawals (id, member_id, requested_amount, status, requested_at, sent_amount, sent_reference, note, processed_by, processed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          rows[0].id, r.memberId, r.amount, r.status, r.requestedAt,
          r.status === 'Sent' ? r.amount : null,
          r.reference || null,
          r.note || null,
          r.status === 'Pending' ? null : processedBy,
          r.processedAt || null,
        ]
      );
    }
    await client.query('COMMIT');
    console.log(`Inserted ${records.length} withdrawal records.`);
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
