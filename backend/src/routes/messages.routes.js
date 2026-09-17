const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const { nextConversationId, nextMessageId } = require('../utils/ids');
const { broadcast } = require('../sse');
const { notifyUser } = require('../utils/notify');
const { validate } = require('../middleware/validate');
const { sendMessageSchema } = require('../validation/messages.schema');

const router = express.Router();

function conversationToClient(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at,
  };
}

function messageToClient(row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderRole: row.sender_role,
    senderId: row.sender_id,
    orderId: row.order_id || undefined,
    body: row.body,
    readByCustomer: row.read_by_customer,
    readByAdmin: row.read_by_admin,
    createdAt: row.created_at,
  };
}

// One thread per customer (conversations.user_id is UNIQUE) - find it, or
// create it on first message. ON CONFLICT DO NOTHING + re-select handles two
// concurrent first-messages racing to create the same customer's conversation.
async function getOrCreateConversationId(userId) {
  const { rows } = await pool.query('SELECT id FROM conversations WHERE user_id = $1', [userId]);
  if (rows[0]) return rows[0].id;
  const id = await nextConversationId(pool);
  await pool.query(
    'INSERT INTO conversations (id, user_id) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING',
    [id, userId]
  );
  const { rows: rows2 } = await pool.query('SELECT id FROM conversations WHERE user_id = $1', [userId]);
  return rows2[0].id;
}

async function loadMessages(conversationId) {
  const { rows } = await pool.query(
    'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
    [conversationId]
  );
  return rows.map(messageToClient);
}

// A message can optionally reference one of the customer's own orders (an
// admin reply about a specific order) - never trust an arbitrary orderId
// from the client, only accept it if it actually belongs to this customer.
async function resolveOwnedOrderId(orderId, userId) {
  if (!orderId) return null;
  const { rows } = await pool.query('SELECT id FROM orders WHERE id = $1 AND user_id = $2', [orderId, userId]);
  return rows[0] ? rows[0].id : null;
}

router.get('/mine', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM conversations WHERE user_id = $1', [req.user.sub]);
  const conversation = rows[0];
  if (!conversation) return res.json({ conversation: null, messages: [] });
  res.json({ conversation: conversationToClient(conversation), messages: await loadMessages(conversation.id) });
}));

router.post('/mine', requireAuth, validate(sendMessageSchema), asyncHandler(async (req, res) => {
  const { body, orderId } = req.body;
  const conversationId = await getOrCreateConversationId(req.user.sub);
  const resolvedOrderId = await resolveOwnedOrderId(orderId, req.user.sub);
  const id = await nextMessageId(pool);
  const { rows } = await pool.query(
    `INSERT INTO messages (id, conversation_id, sender_role, sender_id, order_id, body, read_by_customer, read_by_admin)
     VALUES ($1, $2, 'customer', $3, $4, $5, true, false) RETURNING *`,
    [id, conversationId, req.user.sub, resolvedOrderId, body]
  );
  await pool.query('UPDATE conversations SET last_message_at = now() WHERE id = $1', [conversationId]);
  broadcast('messages');
  res.status(201).json(messageToClient(rows[0]));
}));

router.patch('/mine/read', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT id FROM conversations WHERE user_id = $1', [req.user.sub]);
  if (rows[0]) {
    await pool.query(
      `UPDATE messages SET read_by_customer = true
       WHERE conversation_id = $1 AND sender_role = 'admin' AND read_by_customer = false`,
      [rows[0].id]
    );
  }
  res.json({ ok: true });
}));

router.get('/conversations', requireRole('admin'), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT c.*, u.name AS user_name, u.email AS user_email,
      lm.body AS last_message_body, lm.sender_role AS last_message_sender_role,
      COALESCE(uc.unread_count, 0) AS unread_count
    FROM conversations c
    JOIN users u ON u.id = c.user_id
    LEFT JOIN LATERAL (
      SELECT body, sender_role FROM messages m
      WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1
    ) lm ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS unread_count FROM messages m
      WHERE m.conversation_id = c.id AND m.sender_role = 'customer' AND m.read_by_admin = false
    ) uc ON true
    ORDER BY c.last_message_at DESC
  `);
  res.json(rows.map((row) => ({
    ...conversationToClient(row),
    customerName: row.user_name,
    customerEmail: row.user_email,
    lastMessageBody: row.last_message_body || undefined,
    lastMessageSenderRole: row.last_message_sender_role || undefined,
    unreadCount: Number(row.unread_count),
  })));
}));

router.get('/conversations/:userId', requireRole('admin'), asyncHandler(async (req, res) => {
  const userId = Number(req.params.userId);
  const { rows: userRows } = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [userId]);
  if (!userRows[0]) return res.status(404).json({ error: 'Customer not found.' });

  const { rows: convRows } = await pool.query('SELECT * FROM conversations WHERE user_id = $1', [userId]);
  const conversation = convRows[0];

  const { rows: orderRows } = await pool.query(
    'SELECT * FROM orders WHERE user_id = $1 ORDER BY ordered_at DESC LIMIT 10',
    [userId]
  );
  const orders = await Promise.all(orderRows.map(async (order) => {
    const { rows: items } = await pool.query('SELECT product_name, price, quantity FROM order_items WHERE order_id = $1', [order.id]);
    return {
      id: order.id,
      status: order.status,
      totalAmount: Number(order.total_amount),
      orderedAt: order.ordered_at,
      items: items.map((i) => ({ productName: i.product_name, price: Number(i.price), quantity: i.quantity })),
    };
  }));

  res.json({
    customer: userRows[0],
    conversation: conversation ? conversationToClient(conversation) : null,
    messages: conversation ? await loadMessages(conversation.id) : [],
    orders,
  });
}));

router.post('/conversations/:userId', requireRole('admin'), validate(sendMessageSchema), asyncHandler(async (req, res) => {
  const userId = Number(req.params.userId);
  const { body, orderId } = req.body;
  const { rows: convRows } = await pool.query('SELECT id FROM conversations WHERE user_id = $1', [userId]);
  const conversation = convRows[0];
  if (!conversation) {
    return res.status(404).json({ error: 'This customer has not started a conversation yet.' });
  }
  const resolvedOrderId = await resolveOwnedOrderId(orderId, userId);
  const id = await nextMessageId(pool);
  const { rows } = await pool.query(
    `INSERT INTO messages (id, conversation_id, sender_role, sender_id, order_id, body, read_by_customer, read_by_admin)
     VALUES ($1, $2, 'admin', $3, $4, $5, false, true) RETURNING *`,
    [id, conversation.id, req.user.sub, resolvedOrderId, body]
  );
  await pool.query('UPDATE conversations SET last_message_at = now() WHERE id = $1', [conversation.id]);
  await notifyUser(pool, userId, 'You have a new message from BOCOFAC.', 'info');
  broadcast('messages');
  res.status(201).json(messageToClient(rows[0]));
}));

router.patch('/conversations/:userId/read', requireRole('admin'), asyncHandler(async (req, res) => {
  const userId = Number(req.params.userId);
  const { rows } = await pool.query('SELECT id FROM conversations WHERE user_id = $1', [userId]);
  if (rows[0]) {
    await pool.query(
      `UPDATE messages SET read_by_admin = true
       WHERE conversation_id = $1 AND sender_role = 'customer' AND read_by_admin = false`,
      [rows[0].id]
    );
    broadcast('messages');
  }
  res.json({ ok: true });
}));

module.exports = router;
