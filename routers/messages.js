const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query } = require('../database');
const { requireAuth } = require('../middlewares/auth');
const { requirePlan } = require('../utils/plan_guard');
const { ok, created, fail } = require('../utils/response');
const { generateMessage } = require('../agents/generator');

router.use(requireAuth);
router.use(requirePlan('standard'));

// AI配信文生成
router.post('/generate', async (req, res, next) => {
  try {
    const { purpose, target = '全会員', channel = 'LINE', extra = '' } = req.body;
    if (!purpose) return fail(res, 'purpose は必須です');
    const fullPurpose = extra ? `${purpose}（補足: ${extra}）` : purpose;
    const text = await generateMessage(req.tenant.name, fullPurpose, target, channel);
    return ok(res, { text });
  } catch (err) { next(err); }
});

// 配信ログ保存
router.post('/log', async (req, res, next) => {
  try {
    const { channel, content, recipient_count } = req.body;
    if (!content) return fail(res, 'content は必須です');
    const id = uuidv4();
    const result = await query(
      `INSERT INTO rangemanager.message_logs (id, tenant_id, channel, content, recipient_count)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [id, req.tenant.id, channel || 'LINE', content, parseInt(recipient_count) || 0]
    );
    return created(res, result.rows[0]);
  } catch (err) { next(err); }
});

// 配信ログ一覧
router.get('/log', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM rangemanager.message_logs WHERE tenant_id=$1 ORDER BY sent_at DESC LIMIT 50',
      [req.tenant.id]
    );
    return ok(res, result.rows);
  } catch (err) { next(err); }
});

module.exports = router;
