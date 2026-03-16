const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../database');

const SECRET_KEY = process.env.SECRET_KEY || 'range-manager-dev-secret';

// ── 認証ミドルウェア ──────────────────────────────────────────
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '認証が必要です' });
  }
  try {
    req.tenant = jwt.verify(auth.slice(7), SECRET_KEY);
    next();
  } catch {
    res.status(401).json({ error: 'トークンが無効または期限切れです' });
  }
}

// ── テナント登録 ──────────────────────────────────────────────
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, plan = 'trial' } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name / email / password は必須です' });
    }
    const exists = await query(
      'SELECT id FROM rangemanager.tenants WHERE email = $1', [email]
    );
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'このメールアドレスは既に登録されています' });
    }
    const password_hash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    await query(
      `INSERT INTO rangemanager.tenants (id, name, email, password_hash, plan)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, name, email, password_hash, plan]
    );
    const token = jwt.sign({ id, name, email, plan }, SECRET_KEY, { expiresIn: '24h' });
    res.status(201).json({ token, tenant: { id, name, email, plan } });
  } catch (err) { next(err); }
});

// ── ログイン ──────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email / password は必須です' });
    }
    const result = await query(
      'SELECT * FROM rangemanager.tenants WHERE email = $1', [email]
    );
    const tenant = result.rows[0];
    if (!tenant || !(await bcrypt.compare(password, tenant.password_hash))) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが違います' });
    }
    const { id, name, plan } = tenant;
    const token = jwt.sign({ id, name, email, plan }, SECRET_KEY, { expiresIn: '24h' });
    res.json({ token, tenant: { id, name, email, plan } });
  } catch (err) { next(err); }
});

// ── ログインユーザー情報 ──────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  res.json(req.tenant);
});

module.exports = router;
module.exports.requireAuth = requireAuth;
