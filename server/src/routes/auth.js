const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const { query, queryOne, run } = require('../db/database');
const { generateTokens, authenticate } = require('../middleware/auth');

const router = express.Router();
const otpStore = new Map();

const sendOtpSchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number'),
});

const verifyOtpSchema = z.object({
  phone: z.string(),
  otp: z.string().length(6),
  device_name: z.string().optional(),
});

router.post('/send-otp', async (req, res) => {
  const result = sendOtpSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: result.error.issues[0].message });

  const { phone } = result.data;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(phone, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });

  const isDev = process.env.NODE_ENV !== 'production';
  res.json({ success: true, message: 'OTP sent', ...(isDev && { debug_otp: otp }) });
});

router.post('/verify-otp', async (req, res) => {
  const result = verifyOtpSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: result.error.issues[0].message });

  const { phone, otp, device_name } = result.data;
  const stored = otpStore.get(phone);

  if (!stored || stored.otp !== otp || Date.now() > stored.expiresAt) {
    return res.status(401).json({ error: 'Invalid or expired OTP' });
  }
  otpStore.delete(phone);

  let user = await queryOne('SELECT * FROM users WHERE phone = ?', [phone]);
  const isNew = !user;

  if (!user) {
    const id = uuidv4();
    await run('INSERT INTO users (id, phone, display_name) VALUES (?, ?, ?)', [id, phone, `User ${phone.slice(-4)}`]);
    user = await queryOne('SELECT * FROM users WHERE id = ?', [id]);
    // Create default Cash account
    await run('INSERT INTO accounts (id, user_id, name, type, is_primary) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), id, 'Cash Wallet', 'cash', 1]);
  }

  const { accessToken, refreshToken } = generateTokens(user.id);
  await run(
    "INSERT INTO auth_tokens (id, user_id, token_hash, device_name, expires_at) VALUES (?, ?, ?, ?, NOW() + INTERVAL '30 days')",
    [uuidv4(), user.id, refreshToken.slice(-20), device_name || 'unknown']
  );

  res.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    is_new_user: isNew,
    user: { id: user.id, phone: user.phone, display_name: user.display_name, onboarding_done: !!user.onboarding_done, plan: user.plan || 'free' },
  });
});

router.get('/me', authenticate, async (req, res) => {
  const { id, phone, email, display_name, currency, monthly_salary, salary_day, plan, onboarding_done } = req.user;
  res.json({ id, phone, email, display_name, currency, monthly_salary, salary_day, plan: plan || 'free', onboarding_done: !!onboarding_done });
});

router.patch('/me', authenticate, async (req, res) => {
  const schema = z.object({
    display_name: z.string().min(1).max(100).optional(),
    monthly_salary: z.number().positive().optional(),
    salary_day: z.number().int().min(1).max(28).optional(),
    currency: z.string().length(3).optional(),
    onboarding_done: z.boolean().optional(),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: result.error.issues[0].message });

  const fields = result.data;
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(fields), req.user.id];
  await run(`UPDATE users SET ${sets}, updated_at = NOW() WHERE id = ?`, values);

  const updated = await queryOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
  res.json({ success: true, user: updated });
});

module.exports = router;
