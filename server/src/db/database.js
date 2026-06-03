const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');

let dbUrl = process.env.TURSO_DATABASE_URL;
let authToken = process.env.TURSO_AUTH_TOKEN;

if (!dbUrl) {
  // Fallback to local SQLite file
  const DATA_DIR = path.join(__dirname, '../../data');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  dbUrl = `file:${path.join(DATA_DIR, 'spendwise.db')}`;
}

const db = createClient({
  url: dbUrl,
  ...(authToken ? { authToken } : {}),
});

async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  // Split on semicolons, execute each statement
  const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
  for (const stmt of statements) {
    await db.execute(stmt);
  }

  // Seed system categories if empty
  const result = await db.execute('SELECT COUNT(*) as count FROM categories WHERE is_system = 1');
  if (result.rows[0].count === 0) {
    const cats = [
      ['cat_food',      'Food & Dining',   '🍽️', '#EF4444', 'expense', 1],
      ['cat_delivery',  'Food Delivery',   '🛵', '#F97316', 'expense', 2],
      ['cat_transport', 'Transport',       '🚗', '#3B82F6', 'expense', 3],
      ['cat_rent',      'Rent & Housing',  '🏠', '#8B5CF6', 'expense', 4],
      ['cat_emi',       'EMI',             '🏦', '#6B7280', 'expense', 5],
      ['cat_sip',       'Investments/SIP', '📈', '#10B981', 'expense', 6],
      ['cat_entertain', 'Entertainment',   '🎬', '#EC4899', 'expense', 7],
      ['cat_health',    'Healthcare',      '💊', '#14B8A6', 'expense', 8],
      ['cat_shopping',  'Shopping',        '🛍️', '#F59E0B', 'expense', 9],
      ['cat_utilities', 'Utilities',       '💡', '#84CC16', 'expense', 10],
      ['cat_salary',    'Salary',          '💰', '#22C55E', 'income',  1],
      ['cat_freelance', 'Freelance',       '💻', '#0EA5E9', 'income',  2],
      ['cat_other_inc', 'Other Income',    '💵', '#6EE7B7', 'income',  3],
      ['cat_other_exp', 'Miscellaneous',   '📦', '#9CA3AF', 'expense', 11],
    ];
    for (const [id, name, icon, color, type, sort_order] of cats) {
      await db.execute({
        sql: 'INSERT INTO categories (id, name, icon, color, type, is_system, sort_order) VALUES (?, ?, ?, ?, ?, 1, ?)',
        args: [id, name, icon, color, type, sort_order],
      });
    }
    console.log('  Seeded system categories');
  }
}

// Helper: execute a query and return rows as plain objects
async function query(sql, args = []) {
  const result = await db.execute({ sql, args });
  return result.rows.map(row => Object.fromEntries(Object.entries(row)));
}

// Helper: returns first row or null
async function queryOne(sql, args = []) {
  const rows = await query(sql, args);
  return rows[0] || null;
}

// Helper: execute without returning rows
async function run(sql, args = []) {
  const result = await db.execute({ sql, args });
  return result;
}

module.exports = { db, initDb, query, queryOne, run };
