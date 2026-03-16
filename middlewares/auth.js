const jwt = require('jsonwebtoken');
const { unauthorized } = require('../utils/response');

const SECRET_KEY = process.env.SECRET_KEY || 'range-manager-dev-secret';

/**
 * JWT Bearer トークンを検証し req.tenant にペイロードをセットする
 */
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return unauthorized(res, '認証が必要です');
  }
  try {
    req.tenant = jwt.verify(auth.slice(7), SECRET_KEY);
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError'
      ? 'トークンの有効期限が切れています。再ログインしてください'
      : 'トークンが無効です';
    return unauthorized(res, message);
  }
}

module.exports = { requireAuth, SECRET_KEY };
