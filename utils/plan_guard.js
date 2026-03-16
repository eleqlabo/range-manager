const { forbidden } = require('./response');

const PLAN_LEVELS = { trial: 0, standard: 1, pro: 2, enterprise: 3 };
const PLAN_LABELS = { trial: 'トライアル', standard: 'スタンダード', pro: 'プロ', enterprise: 'エンタープライズ' };

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

module.exports = { requirePlan };
