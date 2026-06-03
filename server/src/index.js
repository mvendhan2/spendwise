const { initDb } = require('./db/database');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const budgetRoutes = require('./routes/budgets');
const analyticsRoutes = require('./routes/analytics');
const accountRoutes = require('./routes/accounts');
const goalRoutes = require('./routes/goals');
const mandatoryRoutes = require('./routes/mandatory');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({ origin: '*' }));  // Tighten in prod
app.use(express.json({ limit: '1mb' }));

// Rate limiting
const limiter = rateLimit({ windowMs: 60 * 1000, max: 100, standardHeaders: true });
const authLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 10, standardHeaders: true });
app.use('/api/', limiter);
app.use('/api/auth/send-otp', authLimiter);

// Routes
app.use('/api/auth',         authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets',      budgetRoutes);
app.use('/api/analytics',    analyticsRoutes);
app.use('/api/accounts',     accountRoutes);
app.use('/api/goals',        goalRoutes);
app.use('/api/mandatory',    mandatoryRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', version: '1.0.0-mvp', timestamp: new Date().toISOString() }));

// 404
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Error handler
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`\n  ✅ SpendWise API running on http://localhost:${PORT}`);
    console.log(`  Health: http://localhost:${PORT}/health\n`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

module.exports = app;
