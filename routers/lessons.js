const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query } = require('../database');
const { requireAuth } = require('../middlewares/auth');
const { requirePlan } = require('../utils/plan_guard');
const { ok, created, fail, notFound } = require('../utils/response');
const { generateLessonReply } = require('../agents/generator');

router.use(requireAuth);
router.use(requirePlan('pro'));

// 予約一覧
router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT l.*, m.name AS member_name
       FROM rangemanager.lessons l
       LEFT JOIN rangemanager.members m ON l.member_id = m.id
       WHERE l.tenant_id=$1 ORDER BY l.start_time DESC LIMIT 100`,
      [req.tenant.id]
    );
    return ok(res, result.rows);
  } catch (err) { next(err); }
});

// 予約作成
router.post('/', async (req, res, next) => {
  try {
    const { member_id, instructor, start_time, end_time, lesson_type = 'マンツーマン', notes } = req.body;
    if (!start_time || !end_time) return fail(res, 'start_time / end_time は必須です');

    const start = new Date(start_time);
    const end = new Date(end_time);
    if (isNaN(start) || isNaN(end)) return fail(res, 'start_time / end_time の形式が不正です（ISO8601）');
    if (end <= start) return fail(res, 'end_time は start_time より後にしてください');

    // インストラクターの二重予約チェック
    if (instructor) {
      const overlap = await query(
        `SELECT id FROM rangemanager.lessons
         WHERE tenant_id=$1 AND instructor=$2 AND status != 'cancelled'
           AND start_time < $4 AND end_time > $3`,
        [req.tenant.id, instructor, start_time, end_time]
      );
      if (overlap.rows.length > 0) {
        return fail(res, '指定のインストラクターはその時間帯に既に予約があります', 409);
      }
    }

    const id = uuidv4();
    const result = await query(
      `INSERT INTO rangemanager.lessons
         (id, tenant_id, member_id, instructor, start_time, end_time, lesson_type, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id, req.tenant.id, member_id || null, instructor || null,
       start_time, end_time, lesson_type, notes || null]
    );
    return created(res, result.rows[0]);
  } catch (err) { next(err); }
});

// ステータス更新
router.put('/:id', async (req, res, next) => {
  try {
    const { status, instructor, notes } = req.body;
    const validStatuses = ['confirmed', 'cancelled', 'completed'];
    if (status && !validStatuses.includes(status)) {
      return fail(res, `status は ${validStatuses.join(' / ')} のいずれかです`);
    }
    const result = await query(
      `UPDATE rangemanager.lessons
         SET status=COALESCE($1, status), instructor=COALESCE($2, instructor),
             notes=COALESCE($3, notes), updated_at=NOW()
       WHERE id=$4 AND tenant_id=$5 RETURNING *`,
      [status || null, instructor || null, notes || null, req.params.id, req.tenant.id]
    );
    if (!result.rows[0]) return notFound(res, '予約が見つかりません');
    return ok(res, result.rows[0]);
  } catch (err) { next(err); }
});

// AI自動返信生成
router.post('/auto-reply', async (req, res, next) => {
  try {
    const { lesson_id } = req.body;
    if (!lesson_id) return fail(res, 'lesson_id は必須です');
    const result = await query(
      `SELECT l.*, m.name AS member_name
       FROM rangemanager.lessons l
       LEFT JOIN rangemanager.members m ON l.member_id = m.id
       WHERE l.id=$1 AND l.tenant_id=$2`,
      [lesson_id, req.tenant.id]
    );
    const lesson = result.rows[0];
    if (!lesson) return notFound(res, '予約が見つかりません');

    const datetime = new Date(lesson.start_time).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    const text = await generateLessonReply(
      req.tenant.name,
      lesson.member_name || 'お客様',
      datetime,
      lesson.instructor || 'インストラクター',
      lesson.lesson_type
    );
    await query('UPDATE rangemanager.lessons SET auto_reply_sent=true WHERE id=$1', [lesson_id]);
    return ok(res, { text, lesson_id });
  } catch (err) { next(err); }
});

module.exports = router;
