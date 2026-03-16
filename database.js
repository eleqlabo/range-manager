const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL が設定されていません');
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      // サーバーレス環境では接続を最小限に抑える
      max: 1,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('[DB] プールエラー:', err.message);
      pool = null; // 次回呼び出し時に再生成
    });
  }
  return pool;
}

async function query(text, params) {
  const client = await getPool().connect();
  try {
    return await client.query(text, params);
  } catch (err) {
    console.error('[DB] クエリエラー:', err.message, '| SQL:', text.slice(0, 80));
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { query };
