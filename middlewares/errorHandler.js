/**
 * Express 集中エラーハンドラ
 * main.js の最後の app.use に登録する
 */
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || '内部エラーが発生しました';

  // DB接続エラーを分かりやすく
  if (err.code === 'ECONNREFUSED' || err.code === '57P03') {
    console.error('[DB] 接続エラー:', err.message);
    return res.status(503).json({ success: false, error: 'データベースに接続できません。しばらく後で再試行してください' });
  }

  if (status >= 500) {
    console.error(`[ERROR] ${req.method} ${req.path}`, err);
  }

  res.status(status).json({ success: false, error: message });
}

module.exports = { errorHandler };
