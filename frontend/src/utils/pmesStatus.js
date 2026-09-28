export function getPmesDisplayStatus(session) {
  if (session.status === 'Cancelled' || session.status === 'Completed') {
    return session.status;
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const sessionDateStr = String(session.date).split('T')[0];

  return sessionDateStr < todayStr ? 'Completed' : 'Upcoming';
}
