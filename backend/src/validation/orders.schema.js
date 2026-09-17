const { z } = require('zod');
const { phSchema, emailSchema } = require('./auth.schema');

// POST /orders is multipart/form-data (uploadOrderReceipt.single('receipt')
// runs first), so `items` arrives here as a raw JSON *string* the route
// parses manually - left untouched by this schema (validated separately,
// right after that parse, via orderItemsSchema below) and passthrough()
// keeps paymentMethod/shippingZone/referenceNumber intact since those are
// still checked inline against their own hardcoded allowlists in the route.
const orderBodySchema = z.object({
  buyerName: z.string().trim().min(1, 'Buyer name is required.').max(200),
  buyerEmail: emailSchema,
  phone: phSchema.optional().nullable().or(z.literal('')),
  shippingAddress: z.string().trim().max(500).optional().nullable().or(z.literal('')),
}).passthrough();

const orderItemsSchema = z.array(z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(999),
})).min(1, 'At least one item is required.').max(50);

module.exports = { orderBodySchema, orderItemsSchema };
