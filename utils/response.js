/**
 * レスポンス形式統一ヘルパー
 * 全ルーターで { success, data, error, message } 形式を使う
 */

function ok(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

function created(res, data) {
  return ok(res, data, 201);
}

function fail(res, message, statusCode = 400) {
  return res.status(statusCode).json({ success: false, error: message });
}

function notFound(res, message = 'リソースが見つかりません') {
  return fail(res, message, 404);
}

function unauthorized(res, message = '認証が必要です') {
  return fail(res, message, 401);
}

function forbidden(res, message, requiredPlan, currentPlan) {
  return res.status(403).json({ success: false, error: message, required_plan: requiredPlan, current_plan: currentPlan });
}

module.exports = { ok, created, fail, notFound, unauthorized, forbidden };
