const express = require('express');
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
const { logStockMovement } = require('../utils/stockMovements');
const { persistUpload, sendStoredFile } = require('../utils/storage');

const router = express.Router();

// [ORDER] Shipping fee depende sa delivery zone
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
    channel: row.channel || 'online',
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

// [DATABASE] Isang query lang para sa items ng lahat ng order (hindi isa-isa bawat order)
async function withItems(orders) {
  const { rows: items } = await pool.query('SELECT * FROM order_items WHERE order_id = ANY($1) ORDER BY id', [orders.map((o) => o.id)]);
  const byOrder = new Map();
  items.forEach((i) => {
    if (!byOrder.has(i.order_id)) byOrder.set(i.order_id, []);
    byOrder.get(i.order_id).push(i);
  });
  return orders.map((o) => toClient(o, byOrder.get(o.id)));
}

router.get('/', requireRole('admin', 'board'), asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM orders ORDER BY ordered_at DESC');
  res.json(await withItems(rows));
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY ordered_at DESC', [req.user.sub]);
  res.json(await withItems(rows));
}));

// [ORDER PROCESSING] Pag-checkout ng customer: validate, compute total, bawas stock, save order
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
  if (req.file) await persistUpload(req.file);
  const shippingFee = SHIPPING_ZONES[shippingZone];

  const userId = req.user.sub;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

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
    const unitPriceByProductId = new Map();
    for (const item of items) {
      const product = productsById.get(item.productId);
      if (!product) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Product ${item.productId} not found.` });
      }
      // [VALIDATION] Bawal umorder ng higit sa natitirang stock
      if (product.stock < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Insufficient stock for ${product.name}. Only ${product.stock} left.` });
      }
      // [ORDER] Server ang nagco-compute ng presyo (promo discount) para hindi madaya sa browser
      const discountPercent = Number(product.discount_percent) || 0;
      const unitPrice = discountPercent > 0
        ? Math.round(Number(product.price) * (1 - discountPercent / 100) * 100) / 100
        : Number(product.price);
      unitPriceByProductId.set(item.productId, unitPrice);
      totalAmount += unitPrice * item.quantity;
    }

    // [ORDER] 10% discount kapag coop member ang bumili
    const MEMBER_DISCOUNT_RATE = 0.10;
    if (isMember) {
      totalAmount = Math.round(totalAmount * (1 - MEMBER_DISCOUNT_RATE) * 100) / 100;
    }
    // [ORDER] Order Total = Subtotal - Member Discount + Shipping Fee
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
      const { rows: updated } = await client.query(
        // [INVENTORY DEDUCTION] Remaining Stock = Current Stock - Quantity Sold; +units sold
        'UPDATE products SET stock = GREATEST(stock - $1, 0), orders_count = orders_count + $1 WHERE id = $2 RETURNING stock',
        [item.quantity, product.id]
      );
      await logStockMovement(client, {
        productId: product.id, change: -item.quantity, stockAfter: updated[0].stock, reason: 'online order', orderId, actorUserId: userId,
      });
    }

    await client.query('COMMIT');
    broadcast('orders');
    broadcast('products');
    res.status(201).json(toClient(rows[0], await loadItems(orderId)));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// [WALK-IN SALE] Admin: itala ang benta sa opisina/tindahan para kasama sa sales, inventory at analytics.
// Completed agad ito, binabawas sa stock, at nakatala kung sinong admin ang nag-record.
const WALK_IN_PAYMENT_METHODS = ['Cash', 'GCash'];
const WALK_IN_EMAIL = 'walk-in@bocofac.local';
const MEMBER_DISCOUNT = 0.10;
const phDate = (d) => new Date(d.getTime() + 8 * 3600000).toISOString().slice(0, 10);

router.post('/walk-in', requireRole('admin'), asyncHandler(async (req, res) => {
  const { items, paymentMethod, soldAt } = req.body;
  const buyerName = (typeof req.body.buyerName === 'string' && req.body.buyerName.trim()) || 'Walk-in Customer';
  const referenceNumber = typeof req.body.referenceNumber === 'string' ? req.body.referenceNumber.trim() : '';
  const memberDiscount = req.body.memberDiscount === true;

  if (!WALK_IN_PAYMENT_METHODS.includes(paymentMethod)) {
    return res.status(400).json({ error: `paymentMethod must be one of: ${WALK_IN_PAYMENT_METHODS.join(', ')}` });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Add at least one product to the sale.' });
  }
  const seen = new Set();
  for (const item of items) {
    if (!item || typeof item.productId !== 'string' || !Number.isInteger(item.quantity) || item.quantity < 1) {
      return res.status(400).json({ error: 'Each item needs a product and a quantity of at least 1.' });
    }
    if (item.price !== undefined && item.price !== null && (typeof item.price !== 'number' || !(item.price >= 0))) {
      return res.status(400).json({ error: 'Item price must be 0 or more.' });
    }
    if (seen.has(item.productId)) {
      return res.status(400).json({ error: 'Each product can only be listed once - change its quantity instead.' });
    }
    seen.add(item.productId);
  }
  const today = phDate(new Date());
  const saleDate = soldAt || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(saleDate) || Number.isNaN(Date.parse(saleDate))) {
    return res.status(400).json({ error: 'soldAt must be a date (YYYY-MM-DD).' });
  }
  if (saleDate > today) {
    return res.status(400).json({ error: 'The sale date cannot be in the future.' });
  }
  // Ngayong araw = oras ngayon; lumang petsa = tanghali (PH) para hindi lumipat ng araw sa ibang timezone
  const orderedAt = saleDate === today ? new Date() : new Date(`${saleDate}T12:00:00+08:00`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: productRows } = await client.query(
      'SELECT * FROM products WHERE id = ANY($1::text[]) FOR UPDATE',
      [items.map((i) => i.productId)]
    );
    const productsById = new Map(productRows.map((p) => [p.id, p]));

    let subtotal = 0;
    const lines = [];
    for (const item of items) {
      const product = productsById.get(item.productId);
      if (!product || !product.is_active) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Product ${item.productId} not found.` });
      }
      if (product.stock < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Not enough stock for ${product.name}. Only ${product.stock} left.` });
      }
      const discountPercent = Number(product.discount_percent) || 0;
      const listPrice = discountPercent > 0
        ? Math.round(Number(product.price) * (1 - discountPercent / 100) * 100) / 100
        : Number(product.price);
      const unitPrice = typeof item.price === 'number' ? Math.round(item.price * 100) / 100 : listPrice;
      subtotal += unitPrice * item.quantity;
      lines.push({ product, quantity: item.quantity, unitPrice });
    }
    const totalAmount = Math.round(subtotal * (memberDiscount ? 1 - MEMBER_DISCOUNT : 1) * 100) / 100;

    const orderId = await nextOrderId(client);
    const { rows } = await client.query(
      `INSERT INTO orders (id, buyer_name, buyer_email, total_amount, payment_method, reference_number, status, member_discount_applied, shipping_fee, ordered_at, channel, recorded_by, verified_by, verified_at)
       VALUES ($1,$2,$3,$4,$5,$6,'Completed',$7,0,$8,'walk-in',$9,$9,now())
       RETURNING *`,
      [orderId, buyerName, WALK_IN_EMAIL, totalAmount, paymentMethod, referenceNumber || null, memberDiscount, orderedAt, req.user.sub]
    );
    for (const line of lines) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, product_name, price, quantity) VALUES ($1,$2,$3,$4,$5)',
        [orderId, line.product.id, line.product.name, line.unitPrice, line.quantity]
      );
      const { rows: updated } = await client.query(
        'UPDATE products SET stock = stock - $1, orders_count = orders_count + $1 WHERE id = $2 RETURNING stock',
        [line.quantity, line.product.id]
      );
      await logStockMovement(client, {
        productId: line.product.id, change: -line.quantity, stockAfter: updated[0].stock, reason: 'walk-in sale', orderId, actorUserId: req.user.sub,
      });
    }
    await auditFromRequest(req, 'order.walk_in', { db: client, entityType: 'order', entityId: orderId, metadata: { totalAmount, soldAt: saleDate } });
    await client.query('COMMIT');
    broadcast('orders');
    broadcast('products');
    res.status(201).json(toClient(rows[0], await loadItems(orderId)));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// [ORDER PROCESSING] Admin/board: i-verify ang GCash payment ng order
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
  const statusMessage = status === 'Shipped'
    ? `Your order ${rows[0].id} is now Delivered to Courier. Estimated delivery is 3-5 days.`
    : `Your order ${rows[0].id} is now ${statusLabel}.`;
  await notifyUser(pool, rows[0].user_id, statusMessage, 'info');
  await auditFromRequest(req, 'order.status', { entityType: 'order', entityId: rows[0].id, metadata: { status } });
  broadcast('orders');
  res.json(toClient(rows[0], await loadItems(rows[0].id)));
}));

// [ORDER PROCESSING] I-reject ang order (hal. mali ang reference) - may dahilan dapat
router.patch('/:id/reject', requireRole('admin', 'board'), asyncHandler(async (req, res) => {
  const reason = (req.body.reason || '').trim();
  if (!reason) {
    return res.status(400).json({ error: 'A rejection reason is required.' });
  }
  const client = await pool.connect();
  let rows;
  let items;
  try {
    await client.query('BEGIN');
    const { rows: existing } = await client.query('SELECT status FROM orders WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!existing[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found.' });
    }
    if (!['Pending Verification', 'Processing'].includes(existing[0].status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `This order is already ${existing[0].status} - it can't be rejected.` });
    }
    ({ rows } = await client.query(
      `UPDATE orders SET status = 'Rejected', rejection_reason = $1, verified_by = $2, verified_at = now()
       WHERE id = $3 RETURNING *`,
      [reason, req.user.sub, req.params.id]
    ));
    ({ rows: items } = await client.query('SELECT * FROM order_items WHERE order_id = $1', [req.params.id]));
    for (const item of items) {
      // [INVENTORY] Hindi natuloy ang benta, kaya ibinabalik ang stock at bawas sa units sold
      const { rows: updated } = await client.query(
        'UPDATE products SET stock = stock + $1, orders_count = GREATEST(orders_count - $1, 0) WHERE id = $2 RETURNING stock',
        [item.quantity, item.product_id]
      );
      await logStockMovement(client, {
        productId: item.product_id, change: item.quantity, stockAfter: updated[0].stock, reason: 'order rejected', orderId: req.params.id, actorUserId: req.user.sub,
      });
    }
    await auditFromRequest(req, 'order.reject', { db: client, entityType: 'order', entityId: req.params.id, metadata: { reason } });
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  await notifyUser(pool, rows[0].user_id, `Your order ${rows[0].id} was rejected: ${reason}`, 'error');
  broadcast('orders');
  broadcast('products');
  res.json(toClient(rows[0], items));
}));

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
      const { rows: updated } = await client.query(
        // [INVENTORY] Pag na-cancel/reject ang order, ibinabalik ang stock
        'UPDATE products SET stock = stock + $1, orders_count = GREATEST(orders_count - $1, 0) WHERE id = $2 RETURNING stock',
        [item.quantity, item.product_id]
      );
      await logStockMovement(client, {
        productId: item.product_id, change: item.quantity, stockAfter: updated[0].stock, reason: 'order cancelled', orderId: order.id, actorUserId: req.user.sub,
      });
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
  await sendStoredFile(res, rows[0].payment_receipt_path);
}));

module.exports = router;
