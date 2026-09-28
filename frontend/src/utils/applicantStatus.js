export function displayApplicantStatus(status) {
  if (status === 'Draft' || status === 'PMES Pending') return 'Pending Review';
  return status;
}
