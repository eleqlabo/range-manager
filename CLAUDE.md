# RangeManager Cloud（レンジマネージャー）

## プロジェクト概要

電設ラボ株式会社が提供するゴルフ練習場向けSaaS。マルチテナント構成。
口コミ返信AI・LINE/メール配信・会員管理・打席管理・誕生日自動送信・キャンペーンAI・レッスン予約AIを提供。

---

## 稼働状況

| 項目 | 内容 |
|------|------|
| **フロントエンド（デモ）** | https://range-manager-demo.vercel.app（公開中） |
| **バックエンド** | Vercel Serverless（Node.js / Express） |
| **AIエンジン** | Gemini API（gemini-2.0-flash） |
| **DB** | Supabase PostgreSQL（schema: rangemanager） |
| **リポジトリ** | github.com/eleqlabo/range-manager |
| **デプロイ** | main へのpushで自動デプロイ（Vercel） |

---

## おもてなしクラウドとの主な違い

| 項目 | おもてなしクラウド | RangeManager Cloud |
|-----|-----------------|-------------------|
| AIエンジン | Claude API | **Gemini API（Google）** |
| バックエンド | FastAPI（Python） | **Vercel Serverless（Node.js）** |
| スケジューラー | APScheduler | **Vercel Cron Jobs** |
| DB | Render PostgreSQL | **Supabase** |
| 特有機能 | 季節の挨拶 | 打席管理・キャンペーンAI・レッスン予約 |

---

## ディレクトリ構成

```
range-manager/
├── main.js                   # Express エントリーポイント・Vercel エクスポート
├── database.js               # Supabase PostgreSQL 接続（pg）
├── package.json
├── vercel.json               # Cron Jobs設定（毎日00:00 誕生日送信）
├── .env.example
├── routers/
│   ├── auth.js               # JWT認証（register / login / me）
│   ├── members.js            # 会員管理CRUD
│   ├── reviews.js            # 口コミ管理・AI返信生成（SSEストリーミング）
│   ├── messages.js           # LINE/メール配信文AI生成・ログ保存
│   ├── campaigns.js          # キャンペーンAI生成
│   ├── lessons.js            # レッスン予約・AI自動返信
│   ├── bays.js               # 打席管理・重複チェック付き予約
│   └── birthday.js           # 誕生日自動送信（Cron対応）
├── agents/
│   ├── generator.js          # Gemini API呼び出し（通常 + ストリーミング）
│   └── prompts.js            # システムプロンプト（多言語対応）
├── utils/
│   └── plan_guard.js         # プラン別アクセス制御ミドルウェア
└── scripts/
    └── setup.sql             # Supabase スキーマ作成SQL
```

---

## APIエンドポイント一覧

| メソッド | パス | プラン | 機能 |
|---------|------|-------|------|
| POST | `/auth/register` | － | テナント登録 |
| POST | `/auth/login` | － | ログイン・JWT発行 |
| GET | `/auth/me` | JWT必須 | ログイン中テナント情報 |
| GET/POST | `/members/` | 全プラン | 会員一覧・作成 |
| GET/PUT/DELETE | `/members/:id` | 全プラン | 会員操作 |
| GET/POST | `/reviews/` | スタンダード以上 | 口コミ一覧・登録 |
| PATCH | `/reviews/:id/reply` | スタンダード以上 | 返信保存 |
| POST | `/reviews/:id/generate-reply` | **プロ以上** | 口コミ返信AI（SSEストリーミング） |
| POST | `/messages/generate` | スタンダード以上 | 配信文AI生成 |
| GET/POST | `/messages/log` | スタンダード以上 | 配信ログ |
| POST | `/campaigns/generate` | スタンダード以上 | キャンペーンAI生成 |
| GET/POST | `/lessons/` | **プロ以上** | レッスン予約 |
| PUT | `/lessons/:id` | **プロ以上** | 予約ステータス更新 |
| POST | `/lessons/auto-reply` | **プロ以上** | AI自動返信生成 |
| GET | `/bays/availability` | 全プラン | 打席空き確認 |
| GET/POST | `/bays/` | 全プラン | 打席予約一覧・作成 |
| PUT | `/bays/:id` | 全プラン | 予約ステータス変更 |
| POST | `/birthday/run` | Cron/手動 | 誕生日送信実行 |

---

## データモデル（Supabase / schema: rangemanager）

| テーブル | 主なカラム |
|---------|-----------|
| `tenants` | id, name, email, password_hash, plan |
| `members` | id, tenant_id, name, email, phone, birthday, rank, membership_number |
| `reviews` | id, tenant_id, platform, reviewer_name, rating, content, reply |
| `message_logs` | id, tenant_id, channel, content, recipient_count, sent_at |
| `bay_reservations` | id, tenant_id, bay_number, member_id, start_time, end_time, status |
| `lessons` | id, tenant_id, member_id, instructor, start_time, end_time, lesson_type, status, auto_reply_sent |

スキーマ作成: `scripts/setup.sql` を Supabase SQL Editor で実行。

---

## プラン構成

| プラン | 価格 | 会員上限 | 機能 |
|-------|------|---------|------|
| トライアル | 無料 | 50名 | 会員管理・打席管理 |
| スタンダード | ¥9,800/月 | 500名 | ＋口コミ管理・AI配信・キャンペーン |
| プロ | ¥19,800/月 | 無制限 | ＋AI口コミ返信・レッスン予約・多言語 |
| エンタープライズ | 要相談 | 無制限 | フルカスタム |

---

## 環境変数（Vercelに設定）

| 変数名 | 用途 | 備考 |
|-------|------|------|
| `GEMINI_API_KEY` | Gemini API キー | **必須** |
| `DATABASE_URL` | Supabase PostgreSQL 接続文字列 | **必須** |
| `SUPABASE_URL` | Supabase プロジェクト URL | 参照用 |
| `SUPABASE_KEY` | Supabase anon キー | 参照用 |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API トークン | birthday.js で使用 |
| `LINE_CHANNEL_SECRET` | LINE チャンネルシークレット | |
| `SECRET_KEY` | JWT 署名キー | **本番は32文字以上のランダム値** |
| `FRONTEND_URL` | CORS 許可URL | `https://range-manager-demo.vercel.app` |

---

## ローカル開発

```bash
cd range-manager
npm install
cp .env.example .env   # 各変数を設定
npm run dev            # http://localhost:3000
```

API ドキュメント（Swagger 代替）: GET /health で稼働確認。

---

## Supabase セットアップ

1. Supabase ダッシュボード → SQL Editor
2. `scripts/setup.sql` の内容をコピーして実行
3. `DATABASE_URL` を Vercel 環境変数に設定

---

## 管理ダッシュボード

| サービス | URL |
|---------|-----|
| Vercel | https://vercel.com/eleqlabo-1033s-projects |
| Supabase | https://supabase.com/dashboard |
| Google AI Studio | https://aistudio.google.com |
| LINE Developers | https://developers.line.biz |

---

## 今後の開発ロードマップ

- [ ] 入退場管理（QRコード・ICカード）
- [ ] ダッシュボード統計API（月別打席稼働率・会員増減）
- [ ] LINE公式アカウント連携（実際の送信）
- [ ] 多言語対応（英語・中国語の口コミ返信）
- [ ] 決済連携（Stripe）

---

## Claude Code での開発ガイド

- 新しいルーターを追加: `routers/` にファイル作成 → `main.js` の `require` と `app.use` に追加
- 新しいAI機能: `agents/prompts.js` にプロンプト追加 → `agents/generator.js` に関数追加
- プラン制限の変更: `utils/plan_guard.js` の `PLAN_LEVELS` を確認して `requirePlan('xxx')` を適用
