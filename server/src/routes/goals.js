const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const { query, queryOne, run } = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const goals = await query(
    "SELECT * FROM goals WHERE user_id = ? AND status != 'cancelled' ORDER BY created_at DESC",
    [req.user.id]
  );

  const enriched = goals.map(g => {
    const progress_pct = g.target_amount > 0 ? (g.current_amount / g.target_amount * 100) : 0;
    const months_remaining = g.deadline
      ? Math.max(0, Math.ceil((new Date(g.deadline) - new Date()) / (1000 * 60 * 60 * 24 * 30)))
      : null;
    return { ...g, progress_pct: Math.min(100, Math.round(progress_pct)), months_remaining };
  });

  res.json(enriched);
});

router.post('/', async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).max(100),
    icon: z.string().optional().default('🎯'),
    target_amount: z.number().positive(),
    deadline: z.string().optional(),
    monthly_contribution: z.number().positive().optional(),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: result.error.issues[0].message });

  const id = uuidv4();
  const { name, icon, target_amount, deadline, monthly_contribution } = result.data;
  await run(
    'INSERT INTO goals (id, user_id, name, icon, target_amount, deadline, monthly_contribution) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, req.user.id, name, icon, target_amount, deadline || null, monthly_contribution || null]
  );

  res.status(201).json(await queryOne('SELECT * FROM goals WHERE id = ?', [id]));
});

router.post('/:id/contribute', async (req, res) => {
  const schema = z.object({ amount: z.number().positive() });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: result.error.issues[0].message });

  const goal = await queryOne('SELECT * FROM goals WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });

  const newAmount = goal.current_amount + result.data.amount;
  const status = newAmount >= goal.target_amount ? 'completed' : 'active';
  await run('UPDATE goals SET current_amount = ?, status = ? WHERE id = ?', [newAmount, status, goal.id]);

  res.json({ success: true, current_amount: newAmount, status });
});

router.delete('/:id', async (req, res) => {
  await run("UPDATE goals SET status = 'cancelled' WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
  res.json({ success: true });
});

module.exports = router;
