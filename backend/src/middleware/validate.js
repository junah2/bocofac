// Wraps a zod schema as Express middleware. Validated/coerced data replaces
// the raw req[source] so downstream handlers can trust types (e.g. a numeric
// string body field becomes an actual number after z.coerce.number()).
// Error shape keeps the `error` string every existing frontend catch block
// already reads (`err.error || 'fallback message'`), and adds a `fields` map
// for callers that want field-level detail.
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const fields = {};
      for (const issue of result.error.issues) {
        fields[issue.path.join('.') || '_'] = issue.message;
      }
      return res.status(400).json({ error: 'Validation failed.', fields });
    }
    req[source] = result.data;
    next();
  };
}

module.exports = { validate };
