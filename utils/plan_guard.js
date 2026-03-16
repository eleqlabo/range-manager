// プラン階層: trial < standard < pro < enterprise
const PLAN_LEVELS = { trial: 0, standard: 1, pro: 2, enterprise: 3 };

/**
 * 指定プラン以上かチェックするミドルウェアを返す
 * @param {string} requiredPlan - 'trial' | 'standard' | 'pro' | 'enterprise'
 */
function requirePlan(requiredPlan) {
  return (req, res, next) => {
    const tenantPlan = req.tenant?.plan || 'trial';
    if ((PLAN_LEVELS[tenantPlan] ?? -1) >= (PLAN_LEVELS[requiredPlan] ?? 99)) {
      return next();
    }
    res.status(403).json({
      error: `この機能は${planLabel(requiredPlan)}以上のプランでご利用いただけます`,
      required_plan: requiredPlan,
      current_plan: tenantPlan,
    });
  };
}

function planLabel(plan) {
  const labels = { trial: 'トライアル', standard: 'スタンダード', pro: 'プロ', enterprise: 'エンタープライズ' };
  return labels[plan] || plan;
}

module.exports = { requirePlan };
