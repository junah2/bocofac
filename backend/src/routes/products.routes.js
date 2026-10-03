const express = require('express');
const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { requireRole } = require('../middleware/auth');
const { broadcast } = require('../sse');
const { nextProductId } = require('../utils/ids');
const { uploadProductImage, verifyUploadedFileType, IMAGE_MIME_TYPES } = require('../middleware/upload');
const { auditFromRequest } = require('../utils/audit');
const { MANUAL_REASONS, logStockMovement, movementToClient } = require('../utils/stockMovements');
const { persistUpload } = require('../utils/storage');

const router = express.Router();

const CATEGORIES = ['Charcoal', 'Fertilizer', 'Fibre & Coir', 'Handicraft'];

function parseSpecifications(raw) {
  if (raw === undefined) return undefined;
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toClient(row) {
  const price = Number(row.price);
  const discountPercent = Number(row.discount_percent) || 0;
  // [PRICING] Sale price = presyo - promo discount %
  const salePrice = discountPercent > 0 ? Math.round(price * (1 - discountPercent / 100) * 100) / 100 : price;
  return {
    id: row.id,
    productNo: row.product_no ?? undefined,
    name: row.name,
    category: row.category,
    description: row.description,
    price,
    discountPercent,
    salePrice,
    stock: row.stock,
    reorderLevel: row.reorder_level ?? 20,
    unit: row.unit,
    image: row.image,
    rating: row.rating === null ? null : Number(row.rating),
    views: row.views,
    ordersCount: row.orders_count,
    specifications: row.specifications || [],
    variantGroup: row.variant_group || undefined,
    variantLabel: row.variant_label || undefined,
    createdAt: row.created_at || undefined,
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM products WHERE is_active = true ORDER BY id');
  res.json(rows.map(toClient));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Product not found.' });
  res.json(toClient(rows[0]));
}));

router.post('/:id/view', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    // [ANALYTICS] +1 view tuwing binubuksan ang product (gamit sa conversion rate)
    'UPDATE products SET views = views + 1 WHERE id = $1 RETURNING *',
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Product not found.' });
  res.json(toClient(rows[0]));
}));

// [INVENTORY] Kasaysayan ng stock ng isang product (pinakabago muna)
router.get('/:id/stock-movements', requireRole('admin', 'board'), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT m.*, u.name AS actor_name, u.email AS actor_email
     FROM stock_movements m LEFT JOIN users u ON u.id = m.actor_user_id
     WHERE m.product_id = $1
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT 200`,
    [req.params.id]
  );
  res.json(rows.map(movementToClient));
}));

// [INVENTORY] Admin/board: manual na pag-update ng stock (restock, sira, expired, adjustment) - may dahilan dapat
router.patch('/:id/stock', requireRole('admin', 'board'), asyncHandler(async (req, res) => {
  const { stock } = req.body;
  const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 300) : '';
  if (!Number.isInteger(stock) || stock < 0) {
    return res.status(400).json({ error: 'stock must be a whole number, 0 or more.' });
  }
  if (req.body.reason !== undefined && !MANUAL_REASONS.includes(req.body.reason)) {
    return res.status(400).json({ error: `reason must be one of: ${MANUAL_REASONS.join(', ')}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: before } = await client.query('SELECT stock FROM products WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!before[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found.' });
    }
    const change = stock - before[0].stock;
    const reason = req.body.reason || (change > 0 ? 'restock' : 'adjustment');
    // [VALIDATION] Dapat tugma ang dahilan sa galaw: restock/returned = dagdag, sira/expired = bawas
    if (change < 0 && ['restock', 'returned'].includes(reason)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `A ${reason} should add stock. Use "adjustment", "damaged" or "expired" to lower it.` });
    }
    if (change > 0 && ['damaged', 'expired'].includes(reason)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Marking items as ${reason} should lower the stock.` });
    }
    const { rows } = await client.query('UPDATE products SET stock = $1 WHERE id = $2 RETURNING *', [stock, req.params.id]);
    await logStockMovement(client, {
      productId: req.params.id, change, stockAfter: stock, reason, note: note || null, actorUserId: req.user.sub,
    });
    if (change !== 0) {
      await auditFromRequest(req, 'product.stock', { db: client, entityType: 'product', entityId: req.params.id, metadata: { change, stock, reason } });
    }
    await client.query('COMMIT');
    broadcast('products');
    res.json(toClient(rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

router.patch('/:id/promo', requireRole('admin'), asyncHandler(async (req, res) => {
  const { discountPercent } = req.body;
  if (typeof discountPercent !== 'number' || Number.isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100) {
    return res.status(400).json({ error: 'discountPercent must be a number between 0 and 100.' });
  }
  const { rows } = await pool.query(
    'UPDATE products SET discount_percent = $1 WHERE id = $2 RETURNING *',
    [discountPercent, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Product not found.' });
  await auditFromRequest(req, 'product.promo', { entityType: 'product', entityId: rows[0].id, metadata: { discountPercent } });
  broadcast('products');
  res.json(toClient(rows[0]));
}));

router.post('/', requireRole('admin'), uploadProductImage.single('image'), asyncHandler(async (req, res) => {
  const { name, category, description, price, unit, variantGroup, variantLabel } = req.body;
  const stock = req.body.stock !== undefined ? Number(req.body.stock) : 0;
  const reorderLevel = req.body.reorderLevel !== undefined && req.body.reorderLevel !== '' ? Number(req.body.reorderLevel) : 20;
  const priceNum = Number(price);

  if (!name || !category || !price) {
    return res.status(400).json({ error: 'name, category, and price are required.' });
  }
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
  }
  if (Number.isNaN(priceNum) || priceNum < 0) {
    return res.status(400).json({ error: 'price must be a non-negative number.' });
  }
  if (!Number.isInteger(stock) || stock < 0) {
    return res.status(400).json({ error: 'stock must be a whole number, 0 or more.' });
  }
  if (!Number.isInteger(reorderLevel) || reorderLevel < 0) {
    return res.status(400).json({ error: 'reorderLevel must be a whole number, 0 or more.' });
  }
  if (req.file && !(await verifyUploadedFileType(req.file.path, IMAGE_MIME_TYPES))) {
    return res.status(400).json({ error: 'Image file content does not match an allowed type (JPG/PNG/WebP).' });
  }
  if (req.file) await persistUpload(req.file);

  const specifications = parseSpecifications(req.body.specifications) || [];
  const image = req.file ? `/uploads/products/${req.file.filename}` : (req.body.image || null);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = await nextProductId(client);
    const { rows } = await client.query(
      `INSERT INTO products (id, name, category, description, price, stock, unit, image, specifications, variant_group, variant_label, reorder_level)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [id, name, category, description || null, priceNum, stock, unit || null, image, specifications, variantGroup || null, variantLabel || null, reorderLevel]
    );
    await logStockMovement(client, { productId: id, change: stock, stockAfter: stock, reason: 'initial stock', actorUserId: req.user.sub });
    await auditFromRequest(req, 'product.create', { db: client, entityType: 'product', entityId: id });
    await client.query('COMMIT');
    broadcast('products');
    res.status(201).json(toClient(rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

router.put('/:id', requireRole('admin'), uploadProductImage.single('image'), asyncHandler(async (req, res) => {
  const { name, category, description, unit, variantGroup, variantLabel } = req.body;
  const price = req.body.price !== undefined ? Number(req.body.price) : undefined;
  const discountPercent = req.body.discountPercent !== undefined ? Number(req.body.discountPercent) : undefined;
  const reorderLevel = req.body.reorderLevel !== undefined && req.body.reorderLevel !== '' ? Number(req.body.reorderLevel) : undefined;

  if (category && !CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
  }
  if (price !== undefined && (Number.isNaN(price) || price < 0)) {
    return res.status(400).json({ error: 'price must be a non-negative number.' });
  }
  if (discountPercent !== undefined && (Number.isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100)) {
    return res.status(400).json({ error: 'discountPercent must be a number between 0 and 100.' });
  }
  if (reorderLevel !== undefined && (!Number.isInteger(reorderLevel) || reorderLevel < 0)) {
    return res.status(400).json({ error: 'reorderLevel must be a whole number, 0 or more.' });
  }
  if (req.file && !(await verifyUploadedFileType(req.file.path, IMAGE_MIME_TYPES))) {
    return res.status(400).json({ error: 'Image file content does not match an allowed type (JPG/PNG/WebP).' });
  }
  if (req.file) await persistUpload(req.file);

  const specifications = parseSpecifications(req.body.specifications);
  const image = req.file ? `/uploads/products/${req.file.filename}` : undefined;

  const { rows } = await pool.query(
    `UPDATE products
     SET name = COALESCE($1, name),
         category = COALESCE($2, category),
         description = COALESCE($3, description),
         price = COALESCE($4, price),
         unit = COALESCE($5, unit),
         specifications = COALESCE($6, specifications),
         image = COALESCE($7, image),
         variant_group = COALESCE($9, variant_group),
         variant_label = COALESCE($10, variant_label),
         discount_percent = COALESCE($11, discount_percent),
         reorder_level = COALESCE($12, reorder_level)
     WHERE id = $8
     RETURNING *`,
    [name, category, description, price, unit, specifications, image, req.params.id, variantGroup, variantLabel, discountPercent, reorderLevel]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Product not found.' });
  await auditFromRequest(req, 'product.update', { entityType: 'product', entityId: rows[0].id });
  broadcast('products');
  res.json(toClient(rows[0]));
}));

router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const { rows: referenced } = await pool.query('SELECT 1 FROM order_items WHERE product_id = $1 LIMIT 1', [req.params.id]);
  if (referenced.length > 0) {
    const { rows } = await pool.query('UPDATE products SET is_active = false WHERE id = $1 RETURNING *', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Product not found.' });
    await auditFromRequest(req, 'product.delete', { entityType: 'product', entityId: rows[0].id, metadata: { softDeleted: true } });
    broadcast('products');
    return res.json({ ...toClient(rows[0]), softDeleted: true });
  }

  const { rowCount } = await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Product not found.' });
  await auditFromRequest(req, 'product.delete', { entityType: 'product', entityId: req.params.id });
  broadcast('products');
  res.status(204).end();
}));

module.exports = router;
