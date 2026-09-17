// In-memory pub/sub for the admin/board realtime feed. A single Node
// process is assumed (see start.bat) - if this ever runs across multiple
// instances, broadcasts would need to go through something shared (e.g.
// Postgres LISTEN/NOTIFY or Redis) instead of this in-process Set.
const clients = new Set();

function subscribe(res) {
  clients.add(res);
}

function unsubscribe(res) {
  clients.delete(res);
}

function broadcast(topic) {
  const payload = `event: ${topic}\ndata: {}\n\n`;
  for (const res of clients) {
    res.write(payload);
  }
}

module.exports = { subscribe, unsubscribe, broadcast };
