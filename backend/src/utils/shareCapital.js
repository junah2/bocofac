// [SHARE CAPITAL] Required share capital: ₱4,000 hanggang ₱25,000; lagpas sa ₱25,000 = savings na
const MIN_REQUIRED_SHARE_CAPITAL = 4000;
const MAX_REQUIRED_SHARE_CAPITAL = 25000;

const SHARE_CAPITAL_CAP = MAX_REQUIRED_SHARE_CAPITAL;

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
