const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query } = require('../database');
const { requireAuth } = require('./auth');

router.use(requireAuth);

// 一覧取得
router.get('/', async (req, res, next) => {
  try {
    const { search, page = 0, limit = 20 } = req.query;
    let sql = 'SELECT * FROM rangemanager.members WHERE tenant_id = $1';
    const params = [req.tenant.id];
    if (search) {
      sql += ' AND (name ILIKE $2 OR email ILIKE $2 OR phone ILIKE $2)';
      params.push(`%${search}%`);
    }
    sql += ` ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(page) * parseInt(limit)}`;
    const result = await query(sql, params);
    const count = await query('SELECT COUNT(*) FROM rangemanager.members WHERE tenant_id = $1', [req.tenant.id]);
    res.json({ members: result.rows, total: parseInt(count.rows[0].count) });
  } catch (err) { next(err); }
});

// 1件取得
router.get('/:id', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM rangemanager.members WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenant.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: '会員が見つかりません' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// 新規登録
router.post('/', async (req, res, next) => {
  try {
    const { name, email, phone, birthday, rank = 'NORMAL', membership_number, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'name は必須です' });
    const id = uuidv4();
    const result = await query(
      `INSERT INTO rangemanager.members
         (id, tenant_id, name, email, phone, birthday, rank, membership_number, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, req.tenant.id, name, email || null, phone || null, birthday || null, rank, membership_number || null, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

// 更新
router.put('/:id', async (req, res, next) => {
  try {
    const { name, email, phone, birthday, rank, membership_number, notes } = req.body;
    const result = await query(
      `UPDATE rangemanager.members SET
         name=$1, email=$2, phone=$3, birthday=$4, rank=$5, membership_number=$6,
         notes=$7, updated_at=NOW()
       WHERE id=$8 AND tenant_id=$9 RETURNING *`,
      [name, email, phone, birthday, rank, membership_number, notes, req.params.id, req.tenant.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: '会員が見つかりません' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// 削除
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await query(
      'DELETE FROM rangemanager.members WHERE id=$1 AND tenant_id=$2 RETURNING id',
      [req.params.id, req.tenant.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: '会員が見つかりません' });
    res.json({ message: '削除しました' });
  } catch (err) { next(err); }
});

module.exports = router;
