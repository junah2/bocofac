const { nextNotificationId } = require('./ids');

// `db` is either the shared pool or a transaction client - callers already
// inside a transaction (e.g. verifying a payment) pass their `client` so the
// notification insert commits/rolls back atomically with the rest of the change.
async function notifyUser(db, userId, message, type = 'info') {
  if (!userId) return;
  const id = await nextNotificationId(db);
  await db.query(
    'INSERT INTO notifications (id, user_id, message, type) VALUES ($1, $2, $3, $4)',
    [id, userId, message, type]
  );
}

// Most cooperative events (payments, withdrawals) are keyed by member_id, not
// the user account directly - look up whichever user(s) are linked to that
// member (normally exactly one, set on Board approval).
async function notifyByMemberId(db, memberId, message, type = 'info') {
  if (!memberId) return;
  const { rows } = await db.query('SELECT id FROM users WHERE member_id = $1', [memberId]);
  for (const row of rows) {
    await notifyUser(db, row.id, message, type);
  }
}

// Membership applications aren't linked to a user account until approval, so
// route their status notifications by the email on file instead.
async function notifyByEmail(db, email, message, type = 'info') {
  if (!email) return;
  const { rows } = await db.query('SELECT id FROM users WHERE lower(email) = lower($1)', [email]);
  for (const row of rows) {
    await notifyUser(db, row.id, message, type);
  }
}

module.exports = { notifyUser, notifyByMemberId, notifyByEmail };
