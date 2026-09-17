const app = require('./app');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`BOCOFAC backend listening on http://localhost:${PORT}`);
});
