const { z } = require('zod');

// Matches the frontend's own PH mobile number rule (11 digits, starts with
// 09) used throughout MembershipPortal.jsx - not a made-up stricter/looser rule.
const phSchema = z.string().regex(/^09\d{9}$/, 'Phone number must be 11 digits starting with 09.');

const emailSchema = z.string().trim().email('Invalid email address.').max(255);

// Capped at 128 in addition to the existing 8-char minimum: bcrypt silently
// truncates input past 72 bytes, so an unbounded max just wastes cycles
// hashing input that can't add any real entropy - 128 is a generous cap that
// still leaves room for a real passphrase. The three .regex() calls enforce
// a minimum character mix (letter + number + special character) on top of
// length alone - mirrored client-side in AuthPages.jsx/DashboardPage.jsx and
// re-checked here since the client-side copy is only a UX nicety.
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

// Shape-only: existence/correctness of the credentials stays the route's job
// so the generic "Invalid email or password" response (and its timing/
// enumeration protection) is unaffected by validation.
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
