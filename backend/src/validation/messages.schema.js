const { z } = require('zod');

const sendMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty.').max(2000, 'Message is too long.'),
  orderId: z.string().trim().min(1).optional().nullable().or(z.literal('')),
});

module.exports = { sendMessageSchema };
