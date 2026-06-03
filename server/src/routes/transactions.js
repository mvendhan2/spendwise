const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const { query, queryOne, run } = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const transactionSchema = z.object({
  amount: z.number().positive(),
  type: z.enum(['debit', 'credit', 'transfer']),
  transacted_at: z.string().optional(),
  category_id: z.string().optional(),
  account_id: z.string().optional(),
  merchant: z.string().max(255).optional(),
  note: z.string().max(500).optional(),
  source: z.enum(['manual', 'bank_sync', 'recurring']).default('manual'),
});

router.get('/', async (req, res) => {
  const { from, to, category, account, search, page = 1, limit = 30, type } = req.query;

  let sql = `
    SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
           a.name as account_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN accounts a ON t.account_id = a.id
    WHERE t.user_id = ? AND t.is_deleted = 0
  `;
  const args = [req.user.id];

  if (from)     { sql += ' AND t.transacted_at >= ?'; args.push(from); }
  if (to)       { sql += ' AND t.transacted_at <= ?'; args.push(to); }
  if (category) { sql += ' AND t.category_id = ?'; args.push(category); }
  if (account)  { sql += ' AND t.account_id = ?'; args.push(account); }
  if (type)     { sql += ' AND t.type = ?'; args.push(type); }
  if (search)   { sql += ' AND (t.merchant LIKE ? OR t.note LIKE ?)'; args.push(`%${search}%`, `%${search}%`); }

  const total = await queryOne(
    sql.replace(/SELECT t\.\*.*FROM/, 'SELECT COUNT(*) as count FROM').replace(/ORDER BY.*$/, ''),
    args
  );

  sql += ' ORDER BY t.transacted_at DESC LIMIT ? OFFSET ?';
  args.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  const transactions = await query(sql, args);
  res.json({ transactions, total: total?.count || 0, page: parseInt(page), limit: parseInt(limit) });
});

router.post('/', async (req, res) => {
  const result = transactionSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: result.error.issues[0].message });

  const data = result.data;
  const id = uuidv4();

  let account_id = data.account_id;
  if (!account_id) {
    const primary = await queryOne('SELECT id FROM accounts WHERE user_id = ? AND is_primary = 1', [req.user.id]);
    account_id = primary?.id || null;
  }

  const transacted_at = data.transacted_at || new Date().toISOString();
  await run(
    'INSERT INTO transactions (id, user_id, account_id, category_id, amount, type, merchant, note, source, transacted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, req.user.id, account_id, data.category_id || null, data.amount, data.type, data.merchant || null, data.note || null, data.source, transacted_at]
  );

  if (account_id) {
    const delta = data.type === 'credit' ? data.amount : -data.amount;
    await run('UPDATE accounts SET balance = balance + ? WHERE id = ?', [delta, account_id]);
  }

  const txn = await queryOne(`
    SELECT t.*, c.name as category_name, c.icon as category_icon
    FROM transactions t LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.id = ?
  `, [id]);

  res.status(201).json(txn);
});

router.get('/:id', async (req, res) => {
  const txn = await queryOne(`
    SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
           a.name as account_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN accounts a ON t.account_id = a.id
    WHERE t.id = ? AND t.user_id = ? AND t.is_deleted = 0
  `, [req.params.id, req.user.id]);

  if (!txn) return res.status(404).json({ error: 'Transaction not found' });
  res.json(txn);
});

router.patch('/:id', async (req, res) => {
  const schema = z.object({
    category_id: z.string().optional(),
    merchant: z.string().max(255).optional(),
    note: z.string().max(500).optional(),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: result.error.issues[0].message });

  const txn = await queryOne('SELECT * FROM transactions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!txn) return res.status(404).json({ error: 'Transaction not found' });

  const fields = result.data;
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  await run(`UPDATE transactions SET ${sets} WHERE id = ?`, [...Object.values(fields), req.params.id]);
  res.json({ success: true });
});

router.delete('/:id', async (req, res) => {
  const txn = await queryOne('SELECT * FROM transactions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!txn) return res.status(404).json({ error: 'Transaction not found' });

  await run('UPDATE transactions SET is_deleted = 1 WHERE id = ?', [req.params.id]);

  if (txn.account_id) {
    const delta = txn.type === 'credit' ? -txn.amount : txn.amount;
    await run('UPDATE accounts SET balance = balance + ? WHERE id = ?', [delta, txn.account_id]);
  }
  res.json({ success: true });
});

module.exports = router;
