const { forbidden } = require('./response');

const PLAN_LEVELS = { trial: 0, standard: 1, pro: 2, enterprise: 3 };
const PLAN_LABELS = { trial: 'トライアル', standard: 'スタンダード', pro: 'プロ', enterprise: 'エンタープライズ' };
const MEMBER_LIMITS = { trial: 50, standard: 500, pro: Infinity, enterprise: Infinity };

function requirePlan(requiredPlan) {
  return (req, res, next) => {
    const tenantPlan = req.tenant?.plan || 'trial';
    if ((PLAN_LEVELS[tenantPlan] ?? -1) >= (PLAN_LEVELS[requiredPlan] ?? 99)) {
      return next();
    }
    return forbidden(
      res,
      `この機能は${PLAN_LABELS[requiredPlan] || requiredPlan}以上のプランでご利用いただけます`,
      requiredPlan,
      tenantPlan
    );
  };
}

/**
 * 会員数上限チェック
 * @param {string} plan - テナントプラン
 * @param {number} currentCount - 現在の会員数
 * @throws {Error} 上限超過時
 */
function checkMemberLimit(plan, currentCount) {
  const limit = MEMBER_LIMITS[plan] ?? MEMBER_LIMITS.trial;
  if (currentCount >= limit) {
    throw Object.assign(
      new Error(`会員数上限（${limit}名）に達しています。プランをアップグレードしてください`),
      { status: 403 }
    );
  }
}

module.exports = { requirePlan, checkMemberLimit, MEMBER_LIMITS };
