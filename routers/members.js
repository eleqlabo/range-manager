const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query } = require('../database');
const { requireAuth } = require('../middlewares/auth');
const { ok, created, fail, notFound } = require('../utils/response');

router.use(requireAuth);

// 一覧取得
router.get('/', async (req, res, next) => {
  try {
    const { search, page = 0, limit = 20 } = req.query;
    const pageNum = Math.max(0, parseInt(page) || 0);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

    let sql = 'SELECT * FROM rangemanager.members WHERE tenant_id=$1';
    const params = [req.tenant.id];
    if (search) {
      sql += ' AND (name ILIKE $2 OR email ILIKE $2 OR phone ILIKE $2)';
      params.push(`%${search}%`);
    }
    sql += ` ORDER BY created_at DESC LIMIT ${limitNum} OFFSET ${pageNum * limitNum}`;

    const [rows, count] = await Promise.all([
      query(sql, params),
      query('SELECT COUNT(*) FROM rangemanager.members WHERE tenant_id=$1', [req.tenant.id]),
    ]);
    return ok(res, { members: rows.rows, total: parseInt(count.rows[0].count), page: pageNum, limit: limitNum });
  } catch (err) { next(err); }
});

// 1件取得
router.get('/:id', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM rangemanager.members WHERE id=$1 AND tenant_id=$2',
      [req.params.id, req.tenant.id]
    );
    if (!result.rows[0]) return notFound(res, '会員が見つかりません');
    return ok(res, result.rows[0]);
  } catch (err) { next(err); }
});

// 新規登録
router.post('/', async (req, res, next) => {
  try {
    const { name, email, phone, birthday, rank = 'NORMAL', membership_number, notes } = req.body;
    if (!name) return fail(res, 'name は必須です');
    const id = uuidv4();
    const result = await query(
      `INSERT INTO rangemanager.members
         (id, tenant_id, name, email, phone, birthday, rank, membership_number, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, req.tenant.id, name, email || null, phone || null, birthday || null, rank, membership_number || null, notes || null]
    );
    return created(res, result.rows[0]);
  } catch (err) { next(err); }
});

// 更新
router.put('/:id', async (req, res, next) => {
  try {
    const { name, email, phone, birthday, rank, membership_number, notes } = req.body;
    if (!name) return fail(res, 'name は必須です');
    const result = await query(
      `UPDATE rangemanager.members SET
         name=$1, email=$2, phone=$3, birthday=$4, rank=$5,
         membership_number=$6, notes=$7, updated_at=NOW()
       WHERE id=$8 AND tenant_id=$9 RETURNING *`,
      [name, email || null, phone || null, birthday || null, rank || 'NORMAL',
       membership_number || null, notes || null, req.params.id, req.tenant.id]
    );
    if (!result.rows[0]) return notFound(res, '会員が見つかりません');
    return ok(res, result.rows[0]);
  } catch (err) { next(err); }
});

// 削除
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await query(
      'DELETE FROM rangemanager.members WHERE id=$1 AND tenant_id=$2 RETURNING id',
      [req.params.id, req.tenant.id]
    );
    if (!result.rows[0]) return notFound(res, '会員が見つかりません');
    return ok(res, { message: '削除しました', id: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
