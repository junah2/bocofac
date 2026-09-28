export function formatDate(dateStr) {
  if (!dateStr) return '';
  return String(dateStr).split('T')[0];
}
