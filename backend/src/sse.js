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
