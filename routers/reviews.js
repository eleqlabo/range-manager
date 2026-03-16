const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query } = require('../database');
const { requireAuth } = require('./auth');
const { requirePlan } = require('../utils/plan_guard');
const { streamReviewReply } = require('../agents/generator');

router.use(requireAuth);
router.use(requirePlan('standard'));

// 一覧取得
router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM rangemanager.reviews WHERE tenant_id=$1 ORDER BY created_at DESC',
      [req.tenant.id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// 登録
router.post('/', async (req, res, next) => {
  try {
    const { platform, reviewer_name, rating, content } = req.body;
    if (!content) return res.status(400).json({ error: 'content は必須です' });
    const id = uuidv4();
    const result = await query(
      `INSERT INTO rangemanager.reviews (id, tenant_id, platform, reviewer_name, rating, content)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, req.tenant.id, platform || 'Google', reviewer_name || 'お客様', rating || 4, content]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// 返信保存
router.patch('/:id/reply', async (req, res, next) => {
  try {
    const { reply } = req.body;
    const result = await query(
      'UPDATE rangemanager.reviews SET reply=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3 RETURNING *',
      [reply, req.params.id, req.tenant.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: '口コミが見つかりません' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// AI返信生成（ストリーミング）— プロ以上
router.post('/:id/generate-reply', requirePlan('pro'), async (req, res, next) => {
  try {
    const review = await query(
      'SELECT * FROM rangemanager.reviews WHERE id=$1 AND tenant_id=$2',
      [req.params.id, req.tenant.id]
    );
    if (!review.rows[0]) return res.status(404).json({ error: '口コミが見つかりません' });
    const { rating, content } = review.rows[0];

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      for await (const chunk of streamReviewReply(req.tenant.name, rating, content)) {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }
    } catch (e) {
      res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
    } finally {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (err) { next(err); }
});

module.exports = router;
