// Cooperative share capital rules, shared between members.routes.js
// (validates the per-member target) and withdrawals.routes.js (splits a
// member's verified payments into share capital vs. savings for earnings
// purposes) so the two never drift apart.
const MIN_REQUIRED_SHARE_CAPITAL = 4000;
const MAX_REQUIRED_SHARE_CAPITAL = 25000;

// Verified payments only count toward share capital (and the earnings it
// accrues) up to this amount - anything a member pays in beyond it is
// tracked as savings instead. Deliberately the same value as the max
// required share capital, since a member's own target can never exceed it.
const SHARE_CAPITAL_CAP = MAX_REQUIRED_SHARE_CAPITAL;

// Returns the validated number, or null if it's outside the allowed range.
function validateRequiredShareCapital(value) {
  const capital = Number(value);
  if (!Number.isFinite(capital) || capital < MIN_REQUIRED_SHARE_CAPITAL || capital > MAX_REQUIRED_SHARE_CAPITAL) {
    return null;
  }
  return capital;
}

module.exports = {
  MIN_REQUIRED_SHARE_CAPITAL,
  MAX_REQUIRED_SHARE_CAPITAL,
  SHARE_CAPITAL_CAP,
  validateRequiredShareCapital,
};
