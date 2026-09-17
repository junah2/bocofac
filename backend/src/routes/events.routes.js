const express = require('express');
const { requireRole } = require('../middleware/auth');
const { subscribe, unsubscribe } = require('../sse');

const router = express.Router();

// Realtime feed for the Admin/Board dashboards - a live connection that
// pushes a `event: <topic>` line the instant orders/members/ledger/
// applicants/pmes-sessions/products change server-side, so those dashboards
// no longer need to poll on a timer to see new activity.
router.get('/', requireRole('admin', 'board'), (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();

  subscribe(res);

  // Keeps the connection open through proxies/load balancers that would
  // otherwise time out an idle HTTP response.
  const heartbeat = setInterval(() => res.write(':heartbeat\n\n'), 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe(res);
  });
});

module.exports = router;
