const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query } = require('../database');
const { requireAuth } = require('./auth');

router.use(requireAuth);

// 打席空き確認
router.get('/availability', async (req, res, next) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const result = await query(
      `SELECT bay_number, status, member_id, start_time, end_time
       FROM rangemanager.bay_reservations
       WHERE tenant_id=$1 AND DATE(start_time)=$2
       ORDER BY bay_number, start_time`,
      [req.tenant.id, targetDate]
    );
    res.json({ date: targetDate, reservations: result.rows });
  } catch (err) { next(err); }
});

// 打席一覧・予約一覧
router.get('/', async (req, res, next) => {
  try {
    const { date } = req.query;
    let sql = `SELECT b.*, m.name AS member_name FROM rangemanager.bay_reservations b
               LEFT JOIN rangemanager.members m ON b.member_id = m.id
               WHERE b.tenant_id=$1`;
    const params = [req.tenant.id];
    if (date) {
      sql += ' AND DATE(b.start_time)=$2';
      params.push(date);
    }
    sql += ' ORDER BY b.start_time DESC LIMIT 100';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { next(err); }
});

// 打席予約
router.post('/', async (req, res, next) => {
  try {
    const { bay_number, member_id, start_time, end_time, notes } = req.body;
    if (!bay_number || !start_time || !end_time) {
      return res.status(400).json({ error: 'bay_number / start_time / end_time は必須です' });
    }
    // 重複チェック
    const overlap = await query(
      `SELECT id FROM rangemanager.bay_reservations
       WHERE tenant_id=$1 AND bay_number=$2 AND status != 'cancelled'
         AND start_time < $4 AND end_time > $3`,
      [req.tenant.id, bay_number, start_time, end_time]
    );
    if (overlap.rows.length > 0) {
      return res.status(409).json({ error: '指定の打席・時間帯はすでに予約済みです' });
    }
    const id = uuidv4();
    const result = await query(
      `INSERT INTO rangemanager.bay_reservations
         (id, tenant_id, bay_number, member_id, start_time, end_time, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, req.tenant.id, bay_number, member_id || null, start_time, end_time, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// ステータス変更・キャンセル
router.put('/:id', async (req, res, next) => {
  try {
    const { status } = req.body;
    const result = await query(
      'UPDATE rangemanager.bay_reservations SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3 RETURNING *',
      [status, req.params.id, req.tenant.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: '予約が見つかりません' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
