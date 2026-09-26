require('../loadEnv');
const bcrypt = require('bcrypt');
const pool = require('./pool');

// Sets a new password for one account and signs it out everywhere - for
// staff accounts whose password needs replacing without going through the
// email reset flow. The password is read from NEW_PASSWORD (set it with
// `read -s`) so it never appears in the command line or shell history.
//   usage: NEW_PASSWORD=... npm run set-password -- admin@bocofac.coop
async function run() {
  const email = process.argv[2];
  const password = process.env.NEW_PASSWORD;
  if (!email || !password) {
    throw new Error('Usage: set NEW_PASSWORD, then: npm run set-password -- <email>');
  }
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    throw new Error('Password must be 8+ characters with a letter, a number, and a special character.');
  }
  const hash = await bcrypt.hash(password, 12);
  const { rows } = await pool.query(
    'UPDATE users SET password_hash = $1, updated_at = now() WHERE lower(email) = lower($2) RETURNING id',
    [hash, email]
  );
  if (!rows[0]) throw new Error(`No account found for ${email}.`);
  await pool.query('DELETE FROM sessions WHERE user_id = $1', [rows[0].id]);
  console.log(`Password updated for ${email} (signed out of all sessions).`);
}

run()
  .catch((err) => {
    console.error('Error:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
