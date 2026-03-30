-- RangeManager Cloud: Supabase PostgreSQL スキーマ
-- 実行: Supabase SQL Editor に貼り付けて実行

CREATE SCHEMA IF NOT EXISTS rangemanager;

-- ── テナント（練習場） ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rangemanager.tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  plan          TEXT NOT NULL DEFAULT 'trial'
                  CHECK (plan IN ('trial','standard','pro','enterprise')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 会員 ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rangemanager.members (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES rangemanager.tenants(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  email             TEXT,
  phone             TEXT,
  birthday          DATE,
  rank              TEXT DEFAULT 'NORMAL'
                      CHECK (rank IN ('NORMAL','SILVER','GOLD','PLATINUM')),
  membership_number TEXT,
  line_user_id      TEXT,                    -- LINE Messaging API 送信用
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 既存テーブルへのマイグレーション（既にテーブルが存在する場合）
ALTER TABLE rangemanager.members
  ADD COLUMN IF NOT EXISTS line_user_id TEXT;

-- ── 口コミ ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rangemanager.reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES rangemanager.tenants(id) ON DELETE CASCADE,
  platform      TEXT DEFAULT 'Google',
  reviewer_name TEXT DEFAULT 'お客様',
  rating        INTEGER DEFAULT 4 CHECK (rating BETWEEN 1 AND 5),
  content       TEXT NOT NULL,
  reply         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 配信ログ ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rangemanager.message_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES rangemanager.tenants(id) ON DELETE CASCADE,
  channel          TEXT DEFAULT 'LINE',
  content          TEXT,
  recipient_count  INTEGER DEFAULT 0,
  sent_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── 打席予約 ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rangemanager.bay_reservations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES rangemanager.tenants(id) ON DELETE CASCADE,
  bay_number  INTEGER NOT NULL CHECK (bay_number >= 1),
  member_id   UUID REFERENCES rangemanager.members(id) ON DELETE SET NULL,
  start_time  TIMESTAMPTZ NOT NULL,
  end_time    TIMESTAMPTZ NOT NULL,
  status      TEXT DEFAULT 'active'
                CHECK (status IN ('active','cancelled','completed')),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT bay_end_after_start CHECK (end_time > start_time)
);

-- ── レッスン予約 ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rangemanager.lessons (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES rangemanager.tenants(id) ON DELETE CASCADE,
  member_id        UUID REFERENCES rangemanager.members(id) ON DELETE SET NULL,
  instructor       TEXT,
  start_time       TIMESTAMPTZ NOT NULL,
  end_time         TIMESTAMPTZ NOT NULL,
  lesson_type      TEXT DEFAULT 'マンツーマン',
  status           TEXT DEFAULT 'confirmed'
                     CHECK (status IN ('confirmed','cancelled','completed')),
  auto_reply_sent  BOOLEAN DEFAULT FALSE,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT lesson_end_after_start CHECK (end_time > start_time)
);

-- ── キャンペーン ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rangemanager.campaigns (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES rangemanager.tenants(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  campaign_type  TEXT NOT NULL DEFAULT 'seasonal',
  catchcopy      TEXT,
  content        TEXT NOT NULL,
  target_segment TEXT,
  period         TEXT,
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','active','ended')),
  start_date     DATE,
  end_date       DATE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── インデックス ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_members_tenant    ON rangemanager.members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_members_birthday  ON rangemanager.members(birthday);
CREATE INDEX IF NOT EXISTS idx_reviews_tenant    ON rangemanager.reviews(tenant_id);
CREATE INDEX IF NOT EXISTS idx_msglogs_tenant    ON rangemanager.message_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bays_tenant_time  ON rangemanager.bay_reservations(tenant_id, start_time);
CREATE INDEX IF NOT EXISTS idx_lessons_tenant    ON rangemanager.lessons(tenant_id, start_time);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant  ON rangemanager.campaigns(tenant_id, created_at);

-- 既存DBへのマイグレーション
ALTER TABLE rangemanager.members ADD COLUMN IF NOT EXISTS line_user_id TEXT;

-- ── デモデータ ────────────────────────────────────────────────────
-- パスワード: demo1234  (bcrypt hash, cost=10)
INSERT INTO rangemanager.tenants (id, name, email, password_hash, plan)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'グリーンヒルゴルフ練習場',
  'demo@greenhill-golf.com',
  '$2b$10$K7L3n0XyZ9mQ2pR8vW1sOuT6eF4hJ5iA0dC3bE7gH9lI1jN2kM4nP',
  'pro'
) ON CONFLICT (email) DO NOTHING;

-- !! 上記ハッシュは demo1234 のダミー値です。
-- !! 実際にログインするには /auth/register でテナントを作成してください。
-- !! または下記コマンドで正しいハッシュを生成:
-- !!   node -e "const b=require('bcryptjs');console.log(b.hashSync('demo1234',10))"
-- !! 生成した値で UPDATE rangemanager.tenants SET password_hash='...' WHERE email='demo@greenhill-golf.com';
