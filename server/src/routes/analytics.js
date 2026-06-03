const express = require('express');
const { query, queryOne } = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/categories', async (req, res) => {
  const categories = await query(
    'SELECT * FROM categories WHERE user_id IS NULL OR user_id = ? ORDER BY type, sort_order',
    [req.user.id]
  );
  res.json(categories);
});

router.get('/spending', async (req, res) => {
  const { period = 'monthly' } = req.query;
  const now = new Date();
  let fromDate;
  if (period === 'weekly') { fromDate = new Date(now); fromDate.setDate(now.getDate() - 7); }
  else if (period === 'yearly') fromDate = new Date(now.getFullYear(), 0, 1);
  else fromDate = new Date(now.getFullYear(), now.getMonth(), 1);

  const fromStr = fromDate.toISOString();

  const byCategory = await query(`
    SELECT c.id, c.name, c.icon, c.color,
           SUM(t.amount) as total, COUNT(*) as count
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND t.type = 'debit' AND t.is_deleted = 0 AND t.transacted_at >= ?
    GROUP BY t.category_id ORDER BY total DESC
  `, [req.user.id, fromStr]);

  const totals = await query(`
    SELECT type, SUM(amount) as total
    FROM transactions
    WHERE user_id = ? AND is_deleted = 0 AND transacted_at >= ?
    GROUP BY type
  `, [req.user.id, fromStr]);

  const income = totals.find(r => r.type === 'credit')?.total || 0;
  const expense = totals.find(r => r.type === 'debit')?.total || 0;

  const daily = await query(`
    SELECT date(transacted_at) as day, SUM(amount) as total
    FROM transactions
    WHERE user_id = ? AND type = 'debit' AND is_deleted = 0 AND transacted_at >= ?
    GROUP BY day ORDER BY day ASC
  `, [req.user.id, fromStr]);

  res.json({
    period, income, expense,
    net_savings: income - expense,
    savings_rate: income > 0 ? ((income - expense) / income * 100).toFixed(1) : 0,
    by_category: byCategory,
    daily_spending: daily,
  });
});

router.get('/trends', async (req, res) => {
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: d.toLocaleString('en-IN', { month: 'short', year: '2-digit' }),
      from: d.toISOString(),
      to: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString(),
    });
  }

  const trends = await Promise.all(months.map(async (m) => {
    const rows = await query(`
      SELECT type, COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE user_id = ? AND is_deleted = 0 AND transacted_at >= ? AND transacted_at <= ?
      GROUP BY type
    `, [req.user.id, m.from, m.to]);

    const income = rows.find(r => r.type === 'credit')?.total || 0;
    const expense = rows.find(r => r.type === 'debit')?.total || 0;
    return { label: m.label, income, expense, savings: income - expense };
  }));

  res.json(trends);
});

router.get('/merchants', async (req, res) => {
  const now = new Date();
  const fromStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const merchants = await query(`
    SELECT merchant, SUM(amount) as total, COUNT(*) as count
    FROM transactions
    WHERE user_id = ? AND type = 'debit' AND is_deleted = 0
      AND transacted_at >= ? AND merchant IS NOT NULL
    GROUP BY merchant ORDER BY total DESC LIMIT 10
  `, [req.user.id, fromStr]);
  res.json(merchants);
});

router.get('/health-score', async (req, res) => {
  const user = req.user;
  const now = new Date();
  const fromStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  if (!user.monthly_salary) {
    return res.json({
      score: null, grade: 'N/A',
      reason: 'Please set your monthly salary in Profile to get a health score.',
      insights: [],
    });
  }

  const income = user.monthly_salary;

  const expenseRow = await queryOne(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE user_id = ? AND type = 'debit' AND is_deleted = 0 AND transacted_at >= ?
  `, [req.user.id, fromStr]);

  const investRow = await queryOne(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE user_id = ? AND type = 'debit' AND is_deleted = 0
      AND transacted_at >= ? AND category_id = 'cat_sip'
  `, [req.user.id, fromStr]);

  const emiRow = await queryOne(
    "SELECT COALESCE(SUM(amount), 0) as total FROM mandatory_expenses WHERE user_id = ? AND type = 'emi'",
    [req.user.id]
  );

  const expenseTotal = expenseRow?.total || 0;
  const investTotal = investRow?.total || 0;
  const emiTotal = emiRow?.total || 0;

  const savingsPct = Math.max(0, (income - expenseTotal) / income * 100);
  const savingsScore = Math.min(100, savingsPct * 5);
  const investRate = income > 0 ? investTotal / income * 100 : 0;
  const investScore = Math.min(100, investRate * 10);
  const dtiRatio = income > 0 ? emiTotal / income * 100 : 0;
  const debtScore = Math.max(0, 100 - Math.max(0, dtiRatio - 20) * 3.33);

  const composite = Math.round(savingsScore * 0.40 + investScore * 0.30 + debtScore * 0.30);
  const grade = composite >= 90 ? 'A+' : composite >= 80 ? 'A' : composite >= 70 ? 'B+' : composite >= 60 ? 'B' : composite >= 50 ? 'C' : composite >= 35 ? 'D' : 'F';

  const insights = [];
  if (savingsPct < 10) insights.push({ type: 'warning', message: `Your savings rate is ${savingsPct.toFixed(1)}% — aim for 20%+ to build financial stability.` });
  else if (savingsPct >= 20) insights.push({ type: 'success', message: `Great job! You're saving ${savingsPct.toFixed(1)}% of your income this month.` });
  if (investRate < 5) insights.push({ type: 'tip', message: `You've invested ${investRate.toFixed(1)}% of income. A SIP of ₹${Math.round(income * 0.1 / 100) * 100}/month could make a big difference.` });
  if (dtiRatio > 40) insights.push({ type: 'warning', message: `Your EMI burden is ${dtiRatio.toFixed(1)}% of income — guidelines recommend keeping it below 40%.` });

  res.json({
    score: composite, grade,
    period: `${now.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}`,
    components: {
      savings_rate: { score: Math.round(savingsScore), value: `${savingsPct.toFixed(1)}%` },
      investment_discipline: { score: Math.round(investScore), value: `${investRate.toFixed(1)}%` },
      debt_ratio: { score: Math.round(debtScore), value: `${dtiRatio.toFixed(1)}%` },
    },
    insights,
  });
});

module.exports = router;
