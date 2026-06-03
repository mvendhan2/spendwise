const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const { query, queryOne, run } = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const items = await query(
    'SELECT * FROM mandatory_expenses WHERE user_id = ? AND is_active = 1 ORDER BY type, amount DESC',
    [req.user.id]
  );
  const total = items.reduce((s, e) => s + e.amount, 0);
  res.json({ items, total });
});

router.post('/', async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).max(100),
    type: z.enum(['rent', 'emi', 'sip', 'insurance', 'subscription', 'other']),
    amount: z.number().positive(),
    due_day: z.number().int().min(1).max(31).optional(),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: result.error.issues[0].message });

  const id = uuidv4();
  const { name, type, amount, due_day } = result.data;
  await run(
    'INSERT INTO mandatory_expenses (id, user_id, name, type, amount, due_day) VALUES (?, ?, ?, ?, ?, ?)',
    [id, req.user.id, name, type, amount, due_day || null]
  );

  res.status(201).json(await queryOne('SELECT * FROM mandatory_expenses WHERE id = ?', [id]));
});

router.patch('/:id', async (req, res) => {
  const item = await queryOne('SELECT * FROM mandatory_expenses WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!item) return res.status(404).json({ error: 'Not found' });

  const schema = z.object({
    name: z.string().optional(),
    amount: z.number().positive().optional(),
    due_day: z.number().int().min(1).max(31).optional(),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: result.error.issues[0].message });

  const fields = result.data;
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  await run(`UPDATE mandatory_expenses SET ${sets} WHERE id = ?`, [...Object.values(fields), req.params.id]);
  res.json({ success: true });
});

router.delete('/:id', async (req, res) => {
  await run('UPDATE mandatory_expenses SET is_active = 0 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ success: true });
});

module.exports = router;
