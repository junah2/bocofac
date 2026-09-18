const express = require('express');
const path = require('path');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const { nextOrderId } = require('../utils/ids');
const { uploadOrderReceipt, verifyUploadedFileType, DOC_MIME_TYPES } = require('../middleware/upload');
const { broadcast } = require('../sse');
const { notifyUser } = require('../utils/notify');
const { auditFromRequest } = require('../utils/audit');
const { validate } = require('../middleware/validate');
const { orderBodySchema, orderItemsSchema } = require('../validation/orders.schema');

const router = express.Router();

// Flat-rate distance tiers instead of a real geocoded distance - the
// cooperative has no mapping/logistics API, so the customer just picks the
// zone their delivery address falls into at checkout. Fee is trusted only
// from this table, never from whatever the client sends.
// BOCOFAC's structured delivery area is Camarines Sur and Camarines Norte;
// orders from anywhere else aren't blocked, they just pay the higher flat fee.
const SHIPPING_ZONES = {
  'Within Town/Municipality': 50,
  'Neighboring Barangay (Lupi Border)': 50,
  'Same Province (Camarines Sur)': 100,
  'Camarines Norte': 200,
  'Outside Delivery Area': 350,
};

function toClient(row, items) {
  return {
    id: row.id,
    userId: row.user_id || undefined,
    buyerName: row.buyer_name,
    buyerEmail: row.buyer_email,
    phone: row.phone,
    shippingAddress: row.shipping_address,
    shippingZone: row.shipping_zone || undefined,
    shippingFee: Number(row.shipping_fee),
    items: (items || []).map((i) => ({
      productId: i.product_id,
      productName: i.product_name,
      price: Number(i.price),
      quantity: i.quantity,
    })),
    totalAmount: Number(row.total_amount),
    memberDiscountApplied: row.member_discount_applied,
    paymentMethod: row.payment_method,
    referenceNumber: row.reference_number,
    status: row.status,
    rejectionReason: row.rejection_reason || undefined,
    orderedAt: row.ordered_at,
  };
}

async function loadItems(orderId) {
  const { rows } = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
  return rows;
}

router.get('/', requireRole('admin', 'board'), asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM orders ORDER BY ordered_at DESC');
  const withItems = await Promise.all(rows.map(async (r) => toClient(r, await loadItems(r.id))));
  res.json(withItems);
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY ordered_at DESC', [req.user.sub]);
  const withItems = await Promise.all(rows.map(async (r) => toClient(r, await loadItems(r.id))));
  res.json(withItems);
}));

// An account is required to order - lets the cooperative actually reach a
// buyer post-purchase (order history, notifications) instead of a one-off
// guest checkout with no way to follow up if the payment reference turns
// out to be wrong or disputed.
router.post('/', requireAuth, uploadOrderReceipt.single('receipt'), validate(orderBodySchema), asyncHandler(async (req, res, next) => {
  const { buyerName, buyerEmail, phone, shippingAddress, paymentMethod, referenceNumber, shippingZone } = req.body;
  let rawItems;
  try {
    rawItems = JSON.parse(req.body.items);
  } catch (err) {
    return res.status(400).json({ error: 'items must be a JSON array of {productId, quantity}.' });
  }
  const itemsResult = orderItemsSchema.safeParse(rawItems);
  if (!itemsResult.success) {
    return res.status(400).json({ error: itemsResult.error.issues[0].message });
  }
  const items = itemsResult.data;
  if (!paymentMethod) {
    return res.status(400).json({ error: 'paymentMethod is required.' });
  }
  if (!Object.prototype.hasOwnProperty.call(SHIPPING_ZONES, shippingZone)) {
    return res.status(400).json({ error: `shippingZone must be one of: ${Object.keys(SHIPPING_ZONES).join(', ')}` });
  }
  if (req.file && !(await verifyUploadedFileType(req.file.path, DOC_MIME_TYPES))) {
    return res.status(400).json({ error: 'Receipt file content does not match an allowed type (image or PDF).' });
  }
  const shippingFee = SHIPPING_ZONES[shippingZone];

  const userId = req.user.sub;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Look up membership fresh from the DB rather than trusting the JWT's
    // memberId claim, which can be stale if approval happened after login.
    let isMember = false;
    if (userId) {
      const { rows: userRows } = await client.query('SELECT member_id FROM users WHERE id = $1', [userId]);
      isMember = !!(userRows[0] && userRows[0].member_id);
    }

    const productIds = items.map((i) => i.productId);
    const productRows = await client.query(
      'SELECT * FROM products WHERE id = ANY($1::text[]) FOR UPDATE',
      [productIds]
    );
    const productsById = new Map(productRows.rows.map((p) => [p.id, p]));

    let totalAmount = 0;
    // Unit price actually charged per product - the admin-set promo discount
    // (products.discount_percent) applied here server-side, not just trusted
    // from whatever the storefront displayed, so the checkout total always
    // matches what's recorded on the order.
    const unitPriceByProductId = new Map();
    for (const item of items) {
      const product = productsById.get(item.productId);
      if (!product) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Product ${item.productId} not found.` });
      }
      if (product.stock < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Insufficient stock for ${product.name}. Only ${product.stock} left.` });
      }
      const discountPercent = Number(product.discount_percent) || 0;
      const unitPrice = discountPercent > 0
        ? Math.round(Number(product.price) * (1 - discountPercent / 100) * 100) / 100
        : Number(product.price);
      unitPriceByProductId.set(item.productId, unitPrice);
      totalAmount += unitPrice * item.quantity;
    }

    const MEMBER_DISCOUNT_RATE = 0.10;
    if (isMember) {
      totalAmount = Math.round(totalAmount * (1 - MEMBER_DISCOUNT_RATE) * 100) / 100;
    }
    totalAmount = Math.round((totalAmount + shippingFee) * 100) / 100;

    const orderId = await nextOrderId(client);
    const receiptPath = req.file ? req.file.path : null;

    const { rows } = await client.query(
      `INSERT INTO orders (id, user_id, buyer_name, buyer_email, phone, shipping_address, total_amount, payment_method, reference_number, payment_receipt_path, status, member_discount_applied, shipping_zone, shipping_fee)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Pending Verification',$11,$12,$13)
       RETURNING *`,
      [orderId, userId, buyerName, buyerEmail, phone || null, shippingAddress || null, totalAmount, paymentMethod, referenceNumber || null, receiptPath, isMember, shippingZone, shippingFee]
    );

    for (const item of items) {
      const product = productsById.get(item.productId);
      await client.query(
        'INSERT INTO order_items (order_id, product_id, product_name, price, quantity) VALUES ($1,$2,$3,$4,$5)',
        [orderId, product.id, product.name, unitPriceByProductId.get(item.productId), item.quantity]
      );
      await client.query(
        'UPDATE products SET stock = GREATEST(stock - $1, 0), orders_count = orders_count + $1 WHERE id = $2',
        [item.quantity, product.id]
      );
    }

    await client.query('COMMIT');
    broadcast('orders');
    broadcast('products'); // stock was just decremented above
    res.status(201).json(toClient(rows[0], await loadItems(orderId)));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

router.patch('/:id/verify', requireRole('admin', 'board'), asyncHandler(async (req, res) => {
  const { rows: existing } = await pool.query('SELECT status FROM orders WHERE id = $1', [req.params.id]);
  if (!existing[0]) return res.status(404).json({ error: 'Order not found.' });
  if (existing[0].status !== 'Pending Verification') {
    return res.status(400).json({ error: `This order is already ${existing[0].status} - it can't be re-verified.` });
  }

  const { rows } = await pool.query(
    `UPDATE orders SET status = 'Processing', verified_by = $1, verified_at = now()
     WHERE id = $2 RETURNING *`,
    [req.user.sub, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Order not found.' });
  await notifyUser(pool, rows[0].user_id, `Your order ${rows[0].id} payment was verified and is now Processing.`, 'success');
  await auditFromRequest(req, 'order.verify', { entityType: 'order', entityId: rows[0].id });
  broadcast('orders');
  res.json(toClient(rows[0], await loadItems(rows[0].id)));
}));

// Fulfillment status progression, updated by admin/board after payment is
// verified (Processing -> Shipped -> Out for Delivery -> Delivered).
const FULFILLMENT_STATUSES = ['Processing', 'Shipped', 'Out for Delivery', 'Delivered'];

router.patch('/:id/status', requireRole('admin', 'board'), asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!FULFILLMENT_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${FULFILLMENT_STATUSES.join(', ')}` });
  }
  const { rows: existing } = await pool.query('SELECT status FROM orders WHERE id = $1', [req.params.id]);
  if (!existing[0]) return res.status(404).json({ error: 'Order not found.' });
  if (![...FULFILLMENT_STATUSES, 'Completed'].includes(existing[0].status)) {
    return res.status(400).json({ error: 'Order must be verified before its fulfillment status can be updated.' });
  }
  const { rows } = await pool.query(
    'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
    [status, req.params.id]
  );
  const statusLabel = status === 'Shipped' ? 'Delivered to Courier' : status;
  // Handing off to the courier is the one fulfillment step admin actually
  // triggers from the UI (see ORDER_FULFILLMENT_STATUSES in
  // AdminDashboardPage.jsx) - give the customer a concrete estimate here
  // rather than a bare status change, since the coop doesn't track courier
  // transit itself and can't notify again once it's actually delivered.
  const statusMessage = status === 'Shipped'
    ? `Your order ${rows[0].id} is now Delivered to Courier. Estimated delivery is 3-5 days.`
    : `Your order ${rows[0].id} is now ${statusLabel}.`;
  await notifyUser(pool, rows[0].user_id, statusMessage, 'info');
  await auditFromRequest(req, 'order.status', { entityType: 'order', entityId: rows[0].id, metadata: { status } });
  broadcast('orders');
  res.json(toClient(rows[0], await loadItems(rows[0].id)));
}));

router.patch('/:id/reject', requireRole('admin', 'board'), asyncHandler(async (req, res) => {
  const reason = (req.body.reason || '').trim();
  if (!reason) {
    return res.status(400).json({ error: 'A rejection reason is required.' });
  }
  const { rows } = await pool.query(
    `UPDATE orders SET status = 'Rejected', rejection_reason = $1, verified_by = $2, verified_at = now()
     WHERE id = $3 RETURNING *`,
    [reason, req.user.sub, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Order not found.' });
  await notifyUser(pool, rows[0].user_id, `Your order ${rows[0].id} was rejected: ${reason}`, 'error');
  await auditFromRequest(req, 'order.reject', { entityType: 'order', entityId: rows[0].id, metadata: { reason } });
  broadcast('orders');
  res.json(toClient(rows[0], await loadItems(rows[0].id)));
}));

// Customer-initiated cancellation. Only allowed before the cooperative has
// verified payment - once verification/fulfillment starts, the customer
// must contact the co-op instead of self-cancelling. Reverses the stock
// reservation made at order creation.
router.patch('/:id/cancel', requireAuth, asyncHandler(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: existing } = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [req.params.id]);
    const order = existing[0];
    if (!order) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found.' });
    }
    if (order.user_id !== req.user.sub) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You can only cancel your own orders.' });
    }
    if (order.status !== 'Pending Verification') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This order can no longer be cancelled - it is already being processed.' });
    }
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    if (Date.now() - new Date(order.ordered_at).getTime() > ONE_DAY_MS) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This order can no longer be cancelled - the 24-hour cancellation window has passed.' });
    }

    const { rows: items } = await client.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
    for (const item of items) {
      await client.query(
        'UPDATE products SET stock = stock + $1, orders_count = GREATEST(orders_count - $1, 0) WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }

    const { rows } = await client.query(
      `UPDATE orders SET status = 'Cancelled' WHERE id = $1 RETURNING *`,
      [order.id]
    );
    await auditFromRequest(req, 'order.cancel', { db: client, entityType: 'order', entityId: order.id });
    await client.query('COMMIT');
    broadcast('orders');
    broadcast('products');
    res.json(toClient(rows[0], items));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

router.get('/:id/receipt', requireRole('admin', 'board'), asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT payment_receipt_path FROM orders WHERE id = $1', [req.params.id]);
  if (!rows[0] || !rows[0].payment_receipt_path) {
    return res.status(404).json({ error: 'No receipt on file for this order.' });
  }
  res.sendFile(path.resolve(rows[0].payment_receipt_path));
}));

module.exports = router;
