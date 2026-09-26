require('../loadEnv');
const pool = require('./pool');

// Changes one account's sign-in email and signs it out everywhere - e.g. to
// move the staff accounts off the placeholder @bocofac.coop addresses onto
// real inboxes, so Forgot Password can actually reach them.
//   usage: npm run set-email -- <current email> <new email>
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function run() {
  const [oldEmail, newEmail] = process.argv.slice(2).map((e) => (e || '').trim());
  if (!oldEmail || !newEmail) throw new Error('Usage: npm run set-email -- <current email> <new email>');
  if (!EMAIL_REGEX.test(newEmail)) throw new Error(`"${newEmail}" is not a valid email address.`);

  const taken = await pool.query('SELECT 1 FROM users WHERE lower(email) = lower($1)', [newEmail]);
  if (taken.rows[0]) throw new Error(`Another account already uses ${newEmail}.`);

  const { rows } = await pool.query(
    'UPDATE users SET email = $1, updated_at = now() WHERE lower(email) = lower($2) RETURNING id, role',
    [newEmail, oldEmail]
  );
  if (!rows[0]) throw new Error(`No account found for ${oldEmail}.`);
  await pool.query('DELETE FROM sessions WHERE user_id = $1', [rows[0].id]);
  console.log(`Email changed: ${oldEmail} -> ${newEmail} (${rows[0].role}; signed out of all sessions).`);
}

run()
  .catch((err) => {
    console.error('Error:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
