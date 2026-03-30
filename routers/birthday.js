const express = require('express');
const router = express.Router();
const https = require('https');
const jwt = require('jsonwebtoken');
const { query } = require('../database');
const { SECRET_KEY } = require('../middlewares/auth');
const { ok } = require('../utils/response');
const { generateBirthdayMessage } = require('../agents/generator');

/**
 * LINE push メッセージ送信
 * @param {string} lineUserId - 送信先 LINE user ID
 * @param {string} text - 送信テキスト
 * @returns {Promise<{ok: boolean, status: number, body: string}>}
 */
async function sendLinePush(lineUserId, text) {
  const token = process.env.RANGE_LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    return { ok: false, status: 0, body: 'RANGE_LINE_CHANNEL_ACCESS_TOKEN が未設定' };
  }
  const payload = JSON.stringify({
    to: lineUserId,
    messages: [{ type: 'text', text }],
  });
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'api.line.me',
        path: '/v2/bot/message/push',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ ok: res.statusCode === 200, status: res.statusCode, body }));
      }
    );
    req.on('error', (err) => resolve({ ok: false, status: 0, body: err.message }));
    req.write(payload);
    req.end();
  });
}

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

        if (!member.line_user_id) {
          // LINE user ID 未登録 → 生成のみ
          results.push({ member_id: member.id, name: member.name, status: 'skipped', reason: 'line_user_id未登録', message });
        } else {
          const lineResult = await sendLinePush(member.line_user_id, message);
          if (lineResult.ok) {
            results.push({ member_id: member.id, name: member.name, status: 'sent', message });
            console.log(`[Birthday] LINE送信成功: ${member.name} (${member.line_user_id})`);
          } else {
            results.push({ member_id: member.id, name: member.name, status: 'line_error', line_status: lineResult.status, error: lineResult.body });
            console.error(`[Birthday] LINE送信失敗: ${member.name} status=${lineResult.status} body=${lineResult.body}`);
          }
        }
      } catch (e) {
        console.error(`[Birthday] ${member.name} の処理失敗:`, e.message);
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
