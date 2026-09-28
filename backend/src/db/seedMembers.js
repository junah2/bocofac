require('../loadEnv');
const pool = require('./pool');

// Adds realistic sample members (with their share capital payment history)
// until the cooperative has TARGET_MEMBERS, so the member and withdrawal
// analytics have a believable population to work with. Matches the shape of
// the existing member records (Filipino names, Camarines Sur addresses,
// NCFRS/RSBSA IDs, ₱300 membership fee) and the app's rules: payments are
// verified GCash / over-the-counter entries with OR numbers, and
// "fully paid" means verified payments reach the member's required share
// capital. Deterministic (fixed random seed).
//   usage: npm run seed-members              (preview only, writes nothing)
//          npm run seed-members -- --apply   (insert the records)
const TARGET_MEMBERS = 220;
const APPLY = process.argv.includes('--apply');

let seed = 20260928;
function rand() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pad = (n, len) => String(n).padStart(len, '0');

const FIRST_NAMES = [
  'Rosario', 'Bienvenido', 'Corazon', 'Rodel', 'Eduardo', 'Marilou', 'Alfredo', 'Josefina',
  'Ramil', 'Leticia', 'Nestor', 'Perla', 'Rogelio', 'Amelia', 'Bayani', 'Zenaida',
  'Efren', 'Gloria', 'Marlon', 'Teresita', 'Domingo', 'Erlinda', 'Ricardo', 'Norma',
  'Wilfredo', 'Adoracion', 'Cesar', 'Milagros', 'Arnel', 'Lourdes', 'Benjamin', 'Aurora',
  'Fernando', 'Remedios', 'Rustico', 'Concepcion', 'Danilo', 'Editha', 'Rodrigo', 'Flordeliza',
  'Armando', 'Susana', 'Jaime', 'Angelita', 'Romeo', 'Virginia', 'Melchor', 'Herminia',
  'Pablito', 'Rowena', 'Jerome', 'Maricel', 'Joel', 'Analyn', 'Reynaldo', 'Jocelyn',
  'Ernesto', 'Marites', 'Dionisio', 'Cristina', 'Lorenzo', 'Evangeline', 'Mario', 'Rosalinda',
  'Antonio', 'Imelda', 'Carlito', 'Nenita', 'Isidro', 'Estrella',
];
const LAST_NAMES = [
  'Bragais', 'Villaruel', 'Nacario', 'Bermundo', 'Casin', 'Obias', 'Peralta', 'Bonto',
  'Dalisay', 'Mercene', 'Barrameda', 'Nieva', 'Odiao', 'Fajardo', 'Belga', 'Sales',
  'Cordial', 'Rebong', 'Bonaobra', 'Gonzaga', 'Salamat', 'Añonuevo', 'Bordado', 'Rosales',
  'Villafuerte', 'Perete', 'Madrid', 'Salvacion', 'Nequinto', 'Bagadiong', 'Buban', 'Casulla',
  'Tamayo', 'Buensalido', 'Fortuna', 'Nabor', 'Panganiban', 'Reonal', 'Sarto', 'Tolentino',
  'Vergara', 'Zabala', 'Alcazar', 'Bordios', 'Camposano', 'Delos Santos', 'Espiritu',
  'Frando', 'Gragasin', 'Abonal', 'Bitara', 'Cledera', 'Dematera', 'Ebreo', 'Llaguno',
  'Moraleda', 'Ordas', 'Pacardo', 'Resari', 'Sañado', 'Tuazon', 'Velarde',
];
const BARANGAYS = [
  'North Villazar', 'South Villazar', 'Impig', 'Lipilip', 'Bagacay', 'Malaguico', 'Salvacion',
  'San Miguel', 'Sagrada Familia', 'San Jose', 'San Rafael', 'Del Rosario', 'Danawan',
  'Cadiz', 'Tarum', 'Amtic', 'Quipia', 'Pangpang', 'Pinit', 'Osmena', 'Tible', 'Sooc',
];
const TOWNS = ['Sipocot', 'Libmanan', 'Cabusao', 'Del Gallego', 'Pamplona', 'Pasacao', 'Lupi'];
const EMAIL_DOMAINS = ['gmail.com', 'gmail.com', 'gmail.com', 'yahoo.com', 'outlook.com'];
const CIVIC_ORGS = [
  'Sitio Torens Farmers Association', 'BOCOFAC Youth Wing', '4-H Club Sipocot Chapter',
  'Barangay Agri Council', 'Camarines Sur Coconut Growers Assoc.', null, null, null,
];
const SHARE_CAPITAL_OPTIONS = [4000, 5000, 5000, 6000, 7500, 10000, 10000, 12500, 15000, 20000, 25000];
const PAYMENT_METHODS = ['GCash', 'GCash', 'GCash', 'Over-the-Counter'];

function randomDateBetween(start, end) {
  const t = new Date(start).getTime() + rand() * (new Date(end).getTime() - new Date(start).getTime());
  return new Date(t).toISOString().slice(0, 10);
}
function daysAfter(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
const gcashReference = () => `${pick(['1', '2', '5', '6', '7', '8', '9'])}${pad(randInt(0, 999999999999), 12)}`;

async function run() {
  const today = new Date().toISOString().slice(0, 10);
  const { rows: countRows } = await pool.query('SELECT COUNT(*)::int AS n FROM members');
  const toAdd = TARGET_MEMBERS - countRows[0].n;
  if (toAdd <= 0) {
    console.log(`Already ${countRows[0].n} members - nothing to add.`);
    return;
  }
  const { rows: emailRows } = await pool.query('SELECT email FROM members UNION SELECT email FROM users');
  const usedEmails = new Set(emailRows.map(r => r.email.toLowerCase()));
  const { rows: admins } = await pool.query(`SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1`);
  const adminId = admins[0] ? admins[0].id : null;
  // Maker-checker, like the app: the admin records a payment, the board verifies it.
  const { rows: board } = await pool.query(`SELECT id FROM users WHERE role = 'board' ORDER BY id LIMIT 1`);
  const boardId = board[0] ? board[0].id : adminId;

  const members = [];
  for (let i = 0; i < toAdd; i++) {
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    const name = `${first} ${String.fromCharCode(65 + randInt(0, 25))}. ${last}`;
    const base = `${first}.${last}`.toLowerCase().normalize('NFD').replace(/[^a-z.]/g, '');
    let email = `${base}@${pick(EMAIL_DOMAINS)}`;
    for (let n = 1; usedEmails.has(email); n++) email = `${base}${n}@${pick(EMAIL_DOMAINS)}`;
    usedEmails.add(email);

    const joinedDate = randomDateBetween('2024-01-15', daysAfter(today, -20));
    const requiredShareCapital = pick(SHARE_CAPITAL_OPTIONS);
    const monthsIn = (new Date(today) - new Date(joinedDate)) / (30 * 86400000);
    // Longer-standing members are more likely to have finished paying.
    const roll = rand();
    const kind = roll < 0.12 ? 'delinquent' : roll < 0.12 + Math.min(0.6, monthsIn / 30) ? 'fullyPaid' : 'paying';

    const member = {
      name, email, requiredShareCapital, joinedDate,
      status: kind === 'delinquent' ? 'Delinquent' : 'Active',
      address: `Purok ${randInt(1, 7)}, Brgy. ${pick(BARANGAYS)}, ${pick(TOWNS)}, Camarines Sur`,
      mobileNumber: `09${pick(['17', '18', '19', '20', '35', '45', '55', '65', '75', '95'])}${pad(randInt(0, 9999999), 7)}`,
      ncfrsId: `NCFRS-${joinedDate.slice(0, 4)}-${pad(randInt(1, 99999), 5)}`,
      rsbsaId: `${pad(randInt(1, 5), 2)}-${pad(randInt(1, 20), 2)}-${pad(randInt(1, 20), 2)}-${pad(randInt(1, 999), 3)}-${pad(randInt(1, 999999), 6)}`,
      membershipFeeDatePaid: daysAfter(joinedDate, randInt(0, 3)),
      membershipFeeReference: gcashReference(),
      hasCv: rand() < 0.85,
      hasFarmPhoto: rand() < 0.8,
      hasShareCert: kind === 'fullyPaid' ? rand() < 0.95 : rand() < 0.4,
      civicOrgAffiliation: pick(CIVIC_ORGS),
      payments: [],
    };

    // Payment plan: fully paid members reach their target exactly, others
    // stop partway; installments are round ₱500 steps, 3-8 weeks apart.
    const target = kind === 'fullyPaid'
      ? requiredShareCapital
      : Math.round((requiredShareCapital * (kind === 'delinquent' ? rand() * 0.3 : 0.2 + rand() * 0.6)) / 500) * 500;
    let left = target;
    let payDate = member.membershipFeeDatePaid;
    const installments = Math.max(1, Math.min(6, Math.ceil(target / pick([1000, 2000, 2500, 5000]))));
    for (let p = 0; p < installments && left > 0; p++) {
      const amount = p === installments - 1 ? left : Math.max(500, Math.round(left / (installments - p) / 500) * 500);
      payDate = daysAfter(payDate, randInt(20, 60));
      if (payDate >= today) break;
      member.payments.push({ amount: Math.min(amount, left), paymentDate: payDate, method: pick(PAYMENT_METHODS) });
      left -= Math.min(amount, left);
    }
    // A payment cut short by "today" means they're still paying, not done.
    member.kind = left === 0 && kind === 'fullyPaid' ? 'fullyPaid' : kind === 'delinquent' ? 'delinquent' : 'paying';
    members.push(member);
  }

  const tally = (k) => members.filter(m => m.kind === k).length;
  const paymentCount = members.reduce((s, m) => s + m.payments.length, 0);
  console.log(`Adding ${members.length} members (${countRows[0].n} -> ${countRows[0].n + members.length}): ${tally('fullyPaid')} fully paid, ${tally('paying')} still paying, ${tally('delinquent')} delinquent. ${paymentCount} share capital payments.`);
  if (!APPLY) {
    console.log('Preview only - run again with --apply to insert.');
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const m of members) {
      const { rows } = await client.query(`SELECT 'M-' || nextval('member_id_seq') AS id`);
      const memberId = rows[0].id;
      await client.query(
        `INSERT INTO members (id, name, email, required_share_capital, joined_date, status, address, mobile_number,
                              ncfrs_id, rsbsa_id, membership_fee, membership_fee_date_paid, membership_fee_reference,
                              has_cv, has_farm_photo, has_share_cert, civic_org_affiliation)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,300,$11,$12,$13,$14,$15,$16)`,
        [memberId, m.name, m.email, m.requiredShareCapital, m.joinedDate, m.status, m.address, m.mobileNumber,
          m.ncfrsId, m.rsbsaId, m.membershipFeeDatePaid, m.membershipFeeReference,
          m.hasCv, m.hasFarmPhoto, m.hasShareCert, m.civicOrgAffiliation]
      );
      for (const p of m.payments) {
        const { rows: ids } = await client.query(
          `SELECT 'TXN-' || nextval('ledger_id_seq') AS id, nextval('ledger_or_seq') AS orn`
        );
        await client.query(
          `INSERT INTO ledger (id, member_id, payment_date, amount, reference_id, payment_method, status,
                               verified_at, verified_by, entered_by, or_number)
           VALUES ($1,$2,$3,$4,$5,$6,'Verified',$7,$8,$9,$10)`,
          [ids[0].id, memberId, p.paymentDate, p.amount,
            p.method === 'Over-the-Counter' ? null : gcashReference(), p.method,
            daysAfter(p.paymentDate, randInt(0, 2)), boardId, adminId,
            `OR-${p.paymentDate.slice(0, 4)}-${pad(ids[0].orn, 6)}`]
        );
      }
    }
    await client.query('COMMIT');
    console.log(`Inserted ${members.length} members and ${paymentCount} payments.`);
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
