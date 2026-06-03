const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const { query, queryOne, run } = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const accounts = await query(
    'SELECT * FROM accounts WHERE user_id = ? AND is_active = 1 ORDER BY is_primary DESC, created_at ASC',
    [req.user.id]
  );
  res.json(accounts);
});

router.post('/', async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).max(100),
    type: z.enum(['bank', 'credit_card', 'cash', 'wallet', 'upi']),
    balance: z.number().default(0),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#6366F1'),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: result.error.issues[0].message });

  const { name, type, balance, color } = result.data;
  const id = uuidv4();
  const hasPrimary = await queryOne('SELECT id FROM accounts WHERE user_id = ? AND is_primary = 1', [req.user.id]);

  await run(
    'INSERT INTO accounts (id, user_id, name, type, balance, color, is_primary) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, req.user.id, name, type, balance, color, hasPrimary ? 0 : 1]
  );

  res.status(201).json(await queryOne('SELECT * FROM accounts WHERE id = ?', [id]));
});

router.patch('/:id', async (req, res) => {
  const account = await queryOne('SELECT * FROM accounts WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!account) return res.status(404).json({ error: 'Account not found' });

  const schema = z.object({
    name: z.string().max(100).optional(),
    color: z.string().optional(),
    is_primary: z.number().optional(),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: result.error.issues[0].message });

  const fields = result.data;
  if (fields.is_primary) {
    await run('UPDATE accounts SET is_primary = 0 WHERE user_id = ?', [req.user.id]);
  }
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  await run(`UPDATE accounts SET ${sets} WHERE id = ?`, [...Object.values(fields), req.params.id]);
  res.json({ success: true });
});

router.delete('/:id', async (req, res) => {
  await run('UPDATE accounts SET is_active = 0 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ success: true });
});

module.exports = router;
