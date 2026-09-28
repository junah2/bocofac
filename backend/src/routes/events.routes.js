const express = require('express');
const { requireRole } = require('../middleware/auth');
const { subscribe, unsubscribe } = require('../sse');

const router = express.Router();

router.get('/', requireRole('admin', 'board'), (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();

  subscribe(res);

  const heartbeat = setInterval(() => res.write(':heartbeat\n\n'), 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe(res);
  });
});

module.exports = router;
