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
