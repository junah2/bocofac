// [INVENTORY] Bawat product ay may sariling reorder level: kapag ganito na lang o mas mababa ang stock,
// kailangan nang mag-restock. 20 ang default para sa mga lumang product.
export const DEFAULT_REORDER_LEVEL = 20;

export const reorderLevelOf = (product) => (Number.isFinite(product?.reorderLevel) ? product.reorderLevel : DEFAULT_REORDER_LEVEL);

export const isLowStock = (product) => product.stock <= reorderLevelOf(product);

// Mga dahilan ng manual na pag-update ng stock. sign: +1 = dagdag, -1 = bawas, 0 = itakda ang eksaktong bilang
export const STOCK_ACTIONS = [
  { reason: 'restock', label: 'Restock (new delivery)', sign: 1 },
  { reason: 'returned', label: 'Returned by buyer', sign: 1 },
  { reason: 'damaged', label: 'Damaged', sign: -1 },
  { reason: 'expired', label: 'Expired / spoiled', sign: -1 },
  { reason: 'adjustment', label: 'Physical count (set exact stock)', sign: 0 },
];

export const MOVEMENT_LABELS = {
  'initial stock': 'Starting stock',
  restock: 'Restock',
  returned: 'Returned',
  damaged: 'Damaged',
  expired: 'Expired',
  adjustment: 'Count adjustment',
  'online order': 'Online order',
  'walk-in sale': 'Walk-in sale',
  'order cancelled': 'Order cancelled',
  'order rejected': 'Order rejected',
};
