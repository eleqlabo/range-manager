require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { errorHandler } = require('./middlewares/errorHandler');

const authRouter      = require('./routers/auth');
const membersRouter   = require('./routers/members');
const reviewsRouter   = require('./routers/reviews');
const messagesRouter  = require('./routers/messages');
const campaignsRouter = require('./routers/campaigns');
const lessonsRouter   = require('./routers/lessons');
const baysRouter      = require('./routers/bays');
const birthdayRouter  = require('./routers/birthday');

const app = express();

// ── CORS ────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL || 'https://range-manager-demo.vercel.app',
  process.env.CORS_ORIGIN,
  'http://localhost:3000',
  'http://localhost:5173',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // 同一オリジン（curlなど origin なし）は許可
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: ${origin} は許可されていません`));
  },
  credentials: true,
}));

app.use(express.json());

// ── ヘルスチェック ───────────────────────────────────────────────
app.get('/', (req, res) => res.json({
  service: 'RangeManager Cloud API',
  status: 'ok',
  timestamp: new Date().toISOString(),
  environment: process.env.NODE_ENV || 'development',
}));

app.get('/health', (req, res) => res.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  environment: process.env.NODE_ENV || 'development',
}));

// ── ルーター ─────────────────────────────────────────────────────
app.use('/auth',      authRouter);
app.use('/members',   membersRouter);
app.use('/reviews',   reviewsRouter);
app.use('/messages',  messagesRouter);
app.use('/campaigns', campaignsRouter);
app.use('/lessons',   lessonsRouter);
app.use('/bays',      baysRouter);
app.use('/birthday',  birthdayRouter);

// ── 404 ─────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ success: false, error: `${req.method} ${req.path} は存在しません` }));

// ── エラーハンドラ ───────────────────────────────────────────────
app.use(errorHandler);

// ── ローカル起動（Vercel では実行されない） ──────────────────────
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`RangeManager Cloud running on http://localhost:${PORT}`));
}

module.exports = app;
