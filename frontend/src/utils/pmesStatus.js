// pmes_sessions.status is a static DB column set at creation (or by an
// admin edit) - the backend never auto-flips it once a session's date has
// passed, so a stale "Upcoming" badge would otherwise stick around forever
// for a session that already happened. Derive the display status from
// today's date instead of trusting the stored value directly, except for
// "Cancelled"/"Completed" which are explicit admin overrides that should
// always win.
export function getPmesDisplayStatus(session) {
  if (session.status === 'Cancelled' || session.status === 'Completed') {
    return session.status;
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const sessionDateStr = String(session.date).split('T')[0];

  return sessionDateStr < todayStr ? 'Completed' : 'Upcoming';
}
