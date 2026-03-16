const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query } = require('../database');
const { requireAuth } = require('../middlewares/auth');
const { ok, created, fail, notFound } = require('../utils/response');

router.use(requireAuth);

// 打席空き確認
router.get('/availability', async (req, res, next) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return fail(res, 'date は YYYY-MM-DD 形式で指定してください');
    }
    const result = await query(
      `SELECT bay_number, status, member_id, start_time, end_time
       FROM rangemanager.bay_reservations
       WHERE tenant_id=$1 AND DATE(start_time AT TIME ZONE 'Asia/Tokyo')=$2
         AND status != 'cancelled'
       ORDER BY bay_number, start_time`,
      [req.tenant.id, targetDate]
    );
    return ok(res, { date: targetDate, reservations: result.rows });
  } catch (err) { next(err); }
});

// 打席予約一覧
router.get('/', async (req, res, next) => {
  try {
    const { date } = req.query;
    let sql = `SELECT b.*, m.name AS member_name
               FROM rangemanager.bay_reservations b
               LEFT JOIN rangemanager.members m ON b.member_id = m.id
               WHERE b.tenant_id=$1`;
    const params = [req.tenant.id];
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(res, 'date は YYYY-MM-DD 形式で指定してください');
      sql += ` AND DATE(b.start_time AT TIME ZONE 'Asia/Tokyo')=$2`;
      params.push(date);
    }
    sql += ' ORDER BY b.start_time DESC LIMIT 100';
    const result = await query(sql, params);
    return ok(res, result.rows);
  } catch (err) { next(err); }
});

// 打席予約作成
router.post('/', async (req, res, next) => {
  try {
    const { bay_number, member_id, start_time, end_time, notes } = req.body;
    if (!bay_number || !start_time || !end_time) {
      return fail(res, 'bay_number / start_time / end_time は必須です');
    }
    const bayNum = parseInt(bay_number);
    if (isNaN(bayNum) || bayNum < 1) return fail(res, 'bay_number は1以上の整数です');

    const start = new Date(start_time);
    const end = new Date(end_time);
    if (isNaN(start) || isNaN(end)) return fail(res, 'start_time / end_time の形式が不正です（ISO8601）');
    if (end <= start) return fail(res, 'end_time は start_time より後にしてください');

    // 重複チェック
    const overlap = await query(
      `SELECT id FROM rangemanager.bay_reservations
       WHERE tenant_id=$1 AND bay_number=$2 AND status != 'cancelled'
         AND start_time < $4 AND end_time > $3`,
      [req.tenant.id, bayNum, start_time, end_time]
    );
    if (overlap.rows.length > 0) {
      return fail(res, '指定の打席・時間帯はすでに予約済みです', 409);
    }

    const id = uuidv4();
    const result = await query(
      `INSERT INTO rangemanager.bay_reservations
         (id, tenant_id, bay_number, member_id, start_time, end_time, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, req.tenant.id, bayNum, member_id || null, start_time, end_time, notes || null]
    );
    return created(res, result.rows[0]);
  } catch (err) { next(err); }
});

// ステータス変更
router.put('/:id', async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['active', 'cancelled', 'completed'];
    if (!status) return fail(res, 'status は必須です');
    if (!validStatuses.includes(status)) {
      return fail(res, `status は ${validStatuses.join(' / ')} のいずれかです`);
    }
    const result = await query(
      'UPDATE rangemanager.bay_reservations SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3 RETURNING *',
      [status, req.params.id, req.tenant.id]
    );
    if (!result.rows[0]) return notFound(res, '予約が見つかりません');
    return ok(res, result.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
