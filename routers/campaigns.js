const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query } = require('../database');
const { requireAuth } = require('../middlewares/auth');
const { requirePlan } = require('../utils/plan_guard');
const { ok, created, fail, notFound } = require('../utils/response');
const { generateCampaign } = require('../agents/generator');

router.use(requireAuth);
router.use(requirePlan('standard'));

// 一覧取得
router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM rangemanager.campaigns WHERE tenant_id=$1';
    const params = [req.tenant.id];
    if (status) {
      sql += ' AND status=$2';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC LIMIT 50';
    const result = await query(sql, params);
    return ok(res, result.rows);
  } catch (err) { next(err); }
});

// 1件取得
router.get('/:id', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM rangemanager.campaigns WHERE id=$1 AND tenant_id=$2',
      [req.params.id, req.tenant.id]
    );
    if (!result.rows[0]) return notFound(res, 'キャンペーンが見つかりません');
    return ok(res, result.rows[0]);
  } catch (err) { next(err); }
});

// AI生成 → DBに保存
router.post('/generate', async (req, res, next) => {
  try {
    const { campaign_type = 'seasonal', details = '', period = '期間限定',
            title, target_segment, start_date, end_date } = req.body;
    if (!details) return fail(res, 'details（キャンペーン内容）は必須です');

    const text = await generateCampaign(req.tenant.name, campaign_type, details, period);

    // 最初の行をキャッチコピー、残りを本文として分割
    const lines = text.trim().split('\n').filter(l => l.trim());
    const catchcopy = lines[0] || '';
    const content = lines.slice(1).join('\n').trim() || text.trim();

    const id = uuidv4();
    const result = await query(
      `INSERT INTO rangemanager.campaigns
         (id, tenant_id, title, campaign_type, catchcopy, content, target_segment, period, start_date, end_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [id, req.tenant.id,
       title || `${campaign_type} キャンペーン`,
       campaign_type, catchcopy, content,
       target_segment || null, period,
       start_date || null, end_date || null]
    );
    return created(res, result.rows[0]);
  } catch (err) { next(err); }
});

// ステータス更新（draft → active → ended）
router.put('/:id', async (req, res, next) => {
  try {
    const { status, title, target_segment, start_date, end_date } = req.body;
    const validStatuses = ['draft', 'active', 'ended'];
    if (status && !validStatuses.includes(status)) {
      return fail(res, `status は ${validStatuses.join(' / ')} のいずれかです`);
    }
    const result = await query(
      `UPDATE rangemanager.campaigns
         SET status=COALESCE($1, status), title=COALESCE($2, title),
             target_segment=COALESCE($3, target_segment),
             start_date=COALESCE($4, start_date), end_date=COALESCE($5, end_date),
             updated_at=NOW()
       WHERE id=$6 AND tenant_id=$7 RETURNING *`,
      [status || null, title || null, target_segment || null,
       start_date || null, end_date || null, req.params.id, req.tenant.id]
    );
    if (!result.rows[0]) return notFound(res, 'キャンペーンが見つかりません');
    return ok(res, result.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
