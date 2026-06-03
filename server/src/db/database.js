const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Railway injects DATABASE_URL automatically
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Convert SQLite-style ? placeholders to PostgreSQL $1, $2, ...
function toPostgres(sql, args) {
  let i = 0;
  const pgSql = sql.replace(/\?/g, () => `$${++i}`);
  return { pgSql, params: args || [] };
}

async function query(sql, args = []) {
  const { pgSql, params } = toPostgres(sql, args);
  const result = await pool.query(pgSql, params);
  // Normalize boolean-like integer columns (pg returns actual booleans for some)
  return result.rows;
}

async function queryOne(sql, args = []) {
  const rows = await query(sql, args);
  return rows[0] || null;
}

async function run(sql, args = []) {
  const { pgSql, params } = toPostgres(sql, args);
  const result = await pool.query(pgSql, params);
  return result;
}

async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  // Strip line comments first, then split on semicolons
  const stripped = schema
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');
  const statements = stripped
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const stmt of statements) {
    await pool.query(stmt);
  }

  // Seed system categories if empty
  const result = await queryOne('SELECT COUNT(*) as count FROM categories WHERE is_system = 1', []);
  if (parseInt(result.count) === 0) {
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
      await pool.query(
        'INSERT INTO categories (id, name, icon, color, type, is_system, sort_order) VALUES ($1,$2,$3,$4,$5,1,$6) ON CONFLICT (id) DO NOTHING',
        [id, name, icon, color, type, sort_order]
      );
    }
    console.log('  Seeded system categories');
  }
}

module.exports = { pool, initDb, query, queryOne, run };
