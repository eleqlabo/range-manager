const express = require('express');
const router = express.Router();
const { requireAuth } = require('./auth');
const { requirePlan } = require('../utils/plan_guard');
const { generateCampaign } = require('../agents/generator');

router.use(requireAuth);
router.use(requirePlan('standard'));

// キャンペーンAI生成
router.post('/generate', async (req, res, next) => {
  try {
    const {
      campaign_type = 'seasonal',
      details = '',
      period = '期間限定',
    } = req.body;
    const text = await generateCampaign(req.tenant.name, campaign_type, details, period);
    res.json({ text });
  } catch (err) { next(err); }
});

module.exports = router;
