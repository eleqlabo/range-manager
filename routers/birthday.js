const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { query } = require('../database');
const { SECRET_KEY } = require('../middlewares/auth');
const { ok } = require('../utils/response');
const { generateBirthdayMessage } = require('../agents/generator');

/**
 * 誕生日送信の共通処理
 * - Vercel Cron (x-vercel-cron: 1) → 全テナント対象
 * - 手動実行 (Bearer JWT) → 当該テナントのみ
 */
async function runBirthday(req, res, next) {
  try {
    const isCron = req.headers['x-vercel-cron'] === '1';

    if (!isCron) {
      const auth = req.headers.authorization;
      if (!auth?.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: '認証が必要です' });
      }
      try {
        req.tenant = jwt.verify(auth.slice(7), SECRET_KEY);
      } catch {
        return res.status(401).json({ success: false, error: 'トークンが無効です' });
      }
    }

    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const mmdd = `${mm}-${dd}`;

    let membersResult;
    if (isCron) {
      membersResult = await query(
        `SELECT m.*, t.name AS facility_name
         FROM rangemanager.members m
         JOIN rangemanager.tenants t ON m.tenant_id = t.id
         WHERE TO_CHAR(m.birthday, 'MM-DD') = $1`,
        [mmdd]
      );
    } else {
      membersResult = await query(
        `SELECT m.*, $2::text AS facility_name
         FROM rangemanager.members m
         WHERE m.tenant_id = $1 AND TO_CHAR(m.birthday, 'MM-DD') = $3`,
        [req.tenant.id, req.tenant.name, mmdd]
      );
    }

    const results = [];
    for (const member of membersResult.rows) {
      try {
        const message = await generateBirthdayMessage(
          member.facility_name,
          member.name,
          member.rank || 'NORMAL',
          ''
        );
        // TODO: LINE送信実装（LINE_CHANNEL_ACCESS_TOKEN使用）
        results.push({ member_id: member.id, name: member.name, status: 'generated', message });
      } catch (e) {
        console.error(`[Birthday] ${member.name} のメッセージ生成失敗:`, e.message);
        results.push({ member_id: member.id, name: member.name, status: 'error', error: e.message });
      }
    }

    return ok(res, { date: mmdd, processed: results.length, results });
  } catch (err) { next(err); }
}

// Vercel Cron Jobs は GET で叩く
router.get('/run', runBirthday);
// 手動実行・テスト用に POST も残す
router.post('/run', runBirthday);

module.exports = router;
