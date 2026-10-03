// [INVENTORY] Itinatala ang bawat galaw ng stock para may kasaysayan (sino, kailan, bakit, ilan)
const MANUAL_REASONS = ['restock', 'adjustment', 'damaged', 'expired', 'returned'];

async function logStockMovement(db, { productId, change, stockAfter, reason, note = null, orderId = null, actorUserId = null }) {
  if (!change) return;
  await db.query(
    `INSERT INTO stock_movements (product_id, change, stock_after, reason, note, order_id, actor_user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [productId, change, stockAfter, reason, note, orderId, actorUserId]
  );
}

function movementToClient(row) {
  return {
    id: Number(row.id),
    productId: row.product_id,
    productName: row.product_name || undefined,
    change: row.change,
    stockAfter: row.stock_after,
    reason: row.reason,
    note: row.note || undefined,
    orderId: row.order_id || undefined,
    actor: row.actor_name || row.actor_email || undefined,
    createdAt: row.created_at,
  };
}

module.exports = { MANUAL_REASONS, logStockMovement, movementToClient };
