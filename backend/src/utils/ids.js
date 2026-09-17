// Formatted IDs are generated from Postgres sequences (see schema.sql) so
// concurrent requests can never collide, unlike the old Math.random() scheme.
async function nextFormattedId(client, sequenceName, prefix) {
  const { rows } = await client.query('SELECT nextval($1) AS n', [sequenceName]);
  return `${prefix}-${rows[0].n}`;
}

const nextMemberId = (client) => nextFormattedId(client, 'member_id_seq', 'M');
const nextLedgerId = (client) => nextFormattedId(client, 'ledger_id_seq', 'TXN');
const nextApplicantId = (client) => nextFormattedId(client, 'applicant_id_seq', 'APP');
const nextOrderId = (client) => nextFormattedId(client, 'order_id_seq', 'ORD');
const nextSessionId = (client) => nextFormattedId(client, 'session_id_seq', 'SEM');
const nextProductId = (client) => nextFormattedId(client, 'product_id_seq', 'prod');
const nextWithdrawalId = (client) => nextFormattedId(client, 'withdrawal_id_seq', 'WD');
const nextNotificationId = (client) => nextFormattedId(client, 'notification_id_seq', 'NTF');
const nextConversationId = (client) => nextFormattedId(client, 'conversation_id_seq', 'CONV');
const nextMessageId = (client) => nextFormattedId(client, 'message_id_seq', 'MSG');

function nextReferenceNumber() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `MOB-${n}`;
}

// OR-<year issued>-<sequence, zero-padded>. The sequence itself never
// resets per year (keeping it a simple always-incrementing Postgres
// sequence) - the year prefix just reflects when the receipt was issued.
async function nextOrNumber(client) {
  const { rows } = await client.query('SELECT nextval($1) AS n', ['ledger_or_seq']);
  const year = new Date().getFullYear();
  return `OR-${year}-${String(rows[0].n).padStart(6, '0')}`;
}

module.exports = {
  nextMemberId,
  nextLedgerId,
  nextApplicantId,
  nextOrderId,
  nextSessionId,
  nextProductId,
  nextWithdrawalId,
  nextNotificationId,
  nextConversationId,
  nextMessageId,
  nextReferenceNumber,
  nextOrNumber,
};
