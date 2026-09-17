// Postgres DATE columns come back from the API as full ISO datetime strings
// (e.g. "2026-07-08T16:00:00.000Z"), unlike the old mock data's plain
// "2026-07-08" strings - trim to the calendar date for display either way.
export function formatDate(dateStr) {
  if (!dateStr) return '';
  return String(dateStr).split('T')[0];
}
