const express = require('express');
const router = express.Router();
const { query } = require('../database');
const { requireAuth } = require('./auth');
const { generateBirthdayMessage } = require('../agents/generator');

// Vercel Cron Jobs から直接呼ばれる（認証スキップ）または手動実行
router.post('/run', async (req, res, next) => {
  try {
    // Vercel Cron からの呼び出しか、ログイン済みテナントの手動実行か確認
    const isCron = req.headers['x-vercel-cron'] === '1';
    if (!isCron) {
      // 手動実行の場合はJWT認証
      const auth = req.headers.authorization;
      if (!auth?.startsWith('Bearer ')) {
        return res.status(401).json({ error: '認証が必要です' });
      }
      const jwt = require('jsonwebtoken');
      const SECRET_KEY = process.env.SECRET_KEY || 'range-manager-dev-secret';
      try {
        req.tenant = jwt.verify(auth.slice(7), SECRET_KEY);
      } catch {
        return res.status(401).json({ error: 'トークンが無効です' });
      }
    }

    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');

    // Cron実行時は全テナント対象、手動実行時は当該テナントのみ
    let membersResult;
    if (isCron) {
      membersResult = await query(
        `SELECT m.*, t.name AS facility_name FROM rangemanager.members m
         JOIN rangemanager.tenants t ON m.tenant_id = t.id
         WHERE TO_CHAR(m.birthday, 'MM-DD') = $1`,
        [`${mm}-${dd}`]
      );
    } else {
      membersResult = await query(
        `SELECT m.*, $2::text AS facility_name FROM rangemanager.members m
         WHERE tenant_id=$1 AND TO_CHAR(birthday, 'MM-DD')=$3`,
        [req.tenant.id, req.tenant.name, `${mm}-${dd}`]
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
        // ここにLINE送信ロジックを追加（LINE_CHANNEL_ACCESS_TOKEN使用）
        results.push({ member_id: member.id, name: member.name, status: 'generated', message });
      } catch (e) {
        results.push({ member_id: member.id, name: member.name, status: 'error', error: e.message });
      }
    }

    res.json({ date: `${mm}-${dd}`, processed: results.length, results });
  } catch (err) { next(err); }
});

module.exports = router;
