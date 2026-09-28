const { nextNotificationId } = require('./ids');

async function notifyUser(db, userId, message, type = 'info') {
  if (!userId) return;
  const id = await nextNotificationId(db);
  await db.query(
    'INSERT INTO notifications (id, user_id, message, type) VALUES ($1, $2, $3, $4)',
    [id, userId, message, type]
  );
}

async function notifyByMemberId(db, memberId, message, type = 'info') {
  if (!memberId) return;
  const { rows } = await db.query('SELECT id FROM users WHERE member_id = $1', [memberId]);
  for (const row of rows) {
    await notifyUser(db, row.id, message, type);
  }
}

async function notifyByEmail(db, email, message, type = 'info') {
  if (!email) return;
  const { rows } = await db.query('SELECT id FROM users WHERE lower(email) = lower($1)', [email]);
  for (const row of rows) {
    await notifyUser(db, row.id, message, type);
  }
}

module.exports = { notifyUser, notifyByMemberId, notifyByEmail };
