/**
 * RangeManager Cloud — テーブル定義リファレンス
 *
 * 実際のテーブルは scripts/setup.sql で Supabase に作成する。
 * このファイルはカラム定義の一覧を示すドキュメント兼、
 * DB から取得した行を整形する toJSON ヘルパーを提供する。
 *
 * schema: rangemanager
 */

// ── tenants ────────────────────────────────────────────────────
// id            UUID PK
// name          TEXT NOT NULL
// email         TEXT UNIQUE NOT NULL
// password_hash TEXT NOT NULL
// plan          TEXT DEFAULT 'trial'   -- trial / standard / pro / enterprise
// created_at    TIMESTAMPTZ
// updated_at    TIMESTAMPTZ

// ── members ────────────────────────────────────────────────────
// id                UUID PK
// tenant_id         UUID FK → tenants.id CASCADE
// name              TEXT NOT NULL
// email             TEXT
// phone             TEXT
// birthday          DATE
// rank              TEXT DEFAULT 'NORMAL'   -- NORMAL / SILVER / GOLD / PLATINUM
// membership_number TEXT
// notes             TEXT
// created_at        TIMESTAMPTZ
// updated_at        TIMESTAMPTZ

// ── reviews ────────────────────────────────────────────────────
// id            UUID PK
// tenant_id     UUID FK → tenants.id CASCADE
// platform      TEXT DEFAULT 'Google'
// reviewer_name TEXT DEFAULT 'お客様'
// rating        INTEGER DEFAULT 4
// content       TEXT NOT NULL
// reply         TEXT
// created_at    TIMESTAMPTZ
// updated_at    TIMESTAMPTZ

// ── message_logs ───────────────────────────────────────────────
// id               UUID PK
// tenant_id        UUID FK → tenants.id CASCADE
// channel          TEXT DEFAULT 'LINE'
// content          TEXT
// recipient_count  INTEGER DEFAULT 0
// sent_at          TIMESTAMPTZ DEFAULT NOW()

// ── bay_reservations ───────────────────────────────────────────
// id          UUID PK
// tenant_id   UUID FK → tenants.id CASCADE
// bay_number  INTEGER NOT NULL
// member_id   UUID FK → members.id SET NULL
// start_time  TIMESTAMPTZ NOT NULL
// end_time    TIMESTAMPTZ NOT NULL
// status      TEXT DEFAULT 'active'   -- active / cancelled / completed
// notes       TEXT
// created_at  TIMESTAMPTZ
// updated_at  TIMESTAMPTZ

// ── lessons ────────────────────────────────────────────────────
// id               UUID PK
// tenant_id        UUID FK → tenants.id CASCADE
// member_id        UUID FK → members.id SET NULL
// instructor       TEXT
// start_time       TIMESTAMPTZ NOT NULL
// end_time         TIMESTAMPTZ NOT NULL
// lesson_type      TEXT DEFAULT 'マンツーマン'
// status           TEXT DEFAULT 'confirmed'   -- confirmed / cancelled / completed
// auto_reply_sent  BOOLEAN DEFAULT FALSE
// notes            TEXT
// created_at       TIMESTAMPTZ
// updated_at       TIMESTAMPTZ

/**
 * テナント行から password_hash を除いて返す
 */
function sanitizeTenant(row) {
  const { password_hash, ...safe } = row;
  return safe;
}

module.exports = { sanitizeTenant };
