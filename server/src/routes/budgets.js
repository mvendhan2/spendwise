const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const { query, queryOne, run } = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const budgets = await query(`
    SELECT b.*, c.name as category_name, c.icon as category_icon, c.color as category_color
    FROM budgets b
    LEFT JOIN categories c ON b.category_id = c.id
    WHERE b.user_id = ? AND b.is_active = 1
  `, [req.user.id]);

  const enriched = await Promise.all(budgets.map(async (budget) => {
    const spent = await queryOne(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE user_id = ? AND type = 'debit' AND is_deleted = 0
        AND transacted_at >= ?
        AND (? IS NULL OR category_id = ?)
    `, [req.user.id, monthStart, budget.category_id, budget.category_id]);

    const usage_pct = budget.amount > 0 ? ((spent?.total || 0) / budget.amount) * 100 : 0;
    return { ...budget, spent: spent?.total || 0, usage_pct: Math.round(usage_pct) };
  }));

  res.json(enriched);
});

// IMPORTANT: must be before /:id
router.get('/safe-to-spend', async (req, res) => {
  const user = req.user;
  const now = new Date();
  const salaryDay = user.salary_day || 1;

  let cycleStart = new Date(now.getFullYear(), now.getMonth(), salaryDay);
  if (now.getDate() < salaryDay) {
    cycleStart = new Date(now.getFullYear(), now.getMonth() - 1, salaryDay);
  }
  const cycleEnd = new Date(cycleStart.getFullYear(), cycleStart.getMonth() + 1, salaryDay - 1);
  const daysInCycle = Math.max(1, Math.ceil((cycleEnd - cycleStart) / (1000 * 60 * 60 * 24)));
  const daysElapsed = Math.ceil((now - cycleStart) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(1, daysInCycle - daysElapsed);
  const cycleStartStr = cycleStart.toISOString();

  const mandatory = await query('SELECT * FROM mandatory_expenses WHERE user_id = ? AND is_active = 1', [req.user.id]);
  const mandatoryTotal = mandatory.reduce((sum, e) => sum + e.amount, 0);
  const mandatoryBreakdown = mandatory.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + e.amount;
    return acc;
  }, {});

  const monthlyIncome = user.monthly_salary || 0;
  const discretionary = Math.max(0, monthlyIncome - mandatoryTotal);

  const spent = await queryOne(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE user_id = ? AND type = 'debit' AND is_deleted = 0
      AND transacted_at >= ?
      AND (category_id NOT IN ('cat_emi', 'cat_rent', 'cat_sip') OR category_id IS NULL)
  `, [req.user.id, cycleStartStr]);

  const spentAmount = spent?.total || 0;
  const remainingBudget = discretionary - spentAmount;
  const safeToSpend = remainingBudget / daysRemaining;

  const warningLevel =
    safeToSpend < 0 ? 'red' :
    safeToSpend < (discretionary / daysInCycle) * 0.7 ? 'orange' : 'green';

  res.json({
    monthly_salary: monthlyIncome,
    mandatory_deductions: { ...mandatoryBreakdown, total: mandatoryTotal },
    discretionary_budget: discretionary,
    spent_this_month: spentAmount,
    remaining_budget: remainingBudget,
    safe_to_spend_today: Math.max(0, Math.round(safeToSpend)),
    days_remaining: daysRemaining,
    warning_level: warningLevel,
    on_track_to_save: remainingBudget > 0,
  });
});

router.post('/', async (req, res) => {
  const schema = z.object({
    category_id: z.string().optional(),
    name: z.string().max(100).optional(),
    amount: z.number().positive(),
    period: z.enum(['weekly', 'monthly', 'yearly']).default('monthly'),
    alert_threshold: z.number().min(1).max(200).default(80),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: result.error.issues[0].message });

  const { category_id, name, amount, period, alert_threshold } = result.data;
  const id = uuidv4();
  const now = new Date();
  const starts_on = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  await run(
    'INSERT INTO budgets (id, user_id, category_id, name, amount, period, alert_threshold, starts_on) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, req.user.id, category_id || null, name || null, amount, period, alert_threshold, starts_on]
  );

  res.status(201).json(await queryOne('SELECT * FROM budgets WHERE id = ?', [id]));
});

router.patch('/:id', async (req, res) => {
  const budget = await queryOne('SELECT * FROM budgets WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!budget) return res.status(404).json({ error: 'Budget not found' });

  const schema = z.object({
    amount: z.number().positive().optional(),
    alert_threshold: z.number().min(1).max(200).optional(),
    is_active: z.number().optional(),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: result.error.issues[0].message });

  const fields = result.data;
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  await run(`UPDATE budgets SET ${sets} WHERE id = ?`, [...Object.values(fields), req.params.id]);
  res.json({ success: true });
});

router.delete('/:id', async (req, res) => {
  await run('UPDATE budgets SET is_active = 0 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ success: true });
});

module.exports = router;
