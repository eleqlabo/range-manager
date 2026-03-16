const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../database');
const { requireAuth, SECRET_KEY } = require('../middlewares/auth');
const { ok, created, fail, unauthorized } = require('../utils/response');

// ── テナント登録 ──────────────────────────────────────────────
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, plan = 'trial' } = req.body;
    if (!name || !email || !password) {
      return fail(res, 'name / email / password は必須です');
    }
    if (password.length < 8) {
      return fail(res, 'パスワードは8文字以上にしてください');
    }
    const exists = await query('SELECT id FROM rangemanager.tenants WHERE email=$1', [email]);
    if (exists.rows.length > 0) {
      return fail(res, 'このメールアドレスは既に登録されています', 409);
    }
    const password_hash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    await query(
      'INSERT INTO rangemanager.tenants (id, name, email, password_hash, plan) VALUES ($1,$2,$3,$4,$5)',
      [id, name, email, password_hash, plan]
    );
    const token = jwt.sign({ id, name, email, plan }, SECRET_KEY, { expiresIn: '24h' });
    return created(res, { token, tenant: { id, name, email, plan } });
  } catch (err) { next(err); }
});

// ── ログイン ──────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return fail(res, 'email / password は必須です');
    }
    const result = await query('SELECT * FROM rangemanager.tenants WHERE email=$1', [email]);
    const tenant = result.rows[0];
    if (!tenant || !(await bcrypt.compare(password, tenant.password_hash))) {
      return unauthorized(res, 'メールアドレスまたはパスワードが違います');
    }
    const { id, name, plan } = tenant;
    const token = jwt.sign({ id, name, email, plan }, SECRET_KEY, { expiresIn: '24h' });
    return ok(res, { token, tenant: { id, name, email, plan } });
  } catch (err) { next(err); }
});

// ── ログインユーザー情報 ──────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  return ok(res, req.tenant);
});

module.exports = router;
// requireAuth は middlewares/auth.js から直接 import すること
