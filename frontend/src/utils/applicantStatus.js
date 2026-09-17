// The board gates full review behind PMES orientation proof (see backend
// applicants.routes.js), so freshly submitted applications sit in 'Draft' or
// 'PMES Pending' until that's done. That reads as "still pending", not "not
// submitted" to anyone outside the board - so collapse both into one
// consistent "Pending Review" label wherever an applicant's status is shown
// (member dashboard, membership portal, board/admin tables).
export function displayApplicantStatus(status) {
  if (status === 'Draft' || status === 'PMES Pending') return 'Pending Review';
  return status;
}
