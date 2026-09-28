const { z } = require('zod');

// [VALIDATION] Contact number: 11 digits, nagsisimula sa 09
const phSchema = z.string().regex(/^09\d{9}$/, 'Phone number must be 11 digits starting with 09.');

const emailSchema = z.string().trim().email('Invalid email address.').max(255);

// [VALIDATION] Password: 8+ characters, may letter, number at special character
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must include at least one letter.')
  .regex(/[0-9]/, 'Password must include at least one number.')
  .regex(/[^A-Za-z0-9]/, 'Password must include at least one special character.');

const signupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(200),
  email: emailSchema,
  phone: phSchema.optional().nullable().or(z.literal('')),
  password: passwordSchema,
});

const signinSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required.'),
});

const updateMeSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(200),
  email: emailSchema,
  phone: phSchema.optional().nullable().or(z.literal('')),
});

module.exports = { signupSchema, signinSchema, updateMeSchema, phSchema, emailSchema, passwordSchema };
