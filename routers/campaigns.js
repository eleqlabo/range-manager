const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/auth');
const { requirePlan } = require('../utils/plan_guard');
const { ok, fail } = require('../utils/response');
const { generateCampaign } = require('../agents/generator');

router.use(requireAuth);
router.use(requirePlan('standard'));

// キャンペーンAI生成
router.post('/generate', async (req, res, next) => {
  try {
    const { campaign_type = 'seasonal', details = '', period = '期間限定' } = req.body;
    if (!details) return fail(res, 'details（キャンペーン内容）は必須です');
    const text = await generateCampaign(req.tenant.name, campaign_type, details, period);
    return ok(res, { text });
  } catch (err) { next(err); }
});

module.exports = router;
