module.exports = function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.code === '23505') {
    return res.status(409).json({ error: 'A record with that value already exists.' });
  }
  if (err.code === '23503') {
    return res.status(409).json({ error: 'This record is still referenced by other data (e.g. existing orders) and cannot be deleted.' });
  }
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal server error.' });
};
