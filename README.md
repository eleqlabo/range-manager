# RangeManager Cloud バックエンド

ゴルフ練習場向けSaaS — Node.js / Express / Vercel Serverless / Supabase PostgreSQL / Gemini API

---

## セットアップ

### 1. パッケージインストール

```bash
npm install
```

### 2. 環境変数

```bash
cp .env.example .env
# .env を編集して各値を設定
```

必須変数:

| 変数名 | 用途 |
|-------|------|
| `GEMINI_API_KEY` | Google AI Studio で取得 |
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection string (Transaction pooler) |
| `SECRET_KEY` | JWT署名キー（32文字以上のランダム文字列） |
| `CORS_ORIGIN` | CORS許可するフロントエンドURL |

### 3. Supabase スキーマ作成

1. [Supabase ダッシュボード](https://supabase.com/dashboard) にログイン
2. 対象プロジェクト → **SQL Editor**
3. `scripts/setup.sql` の内容をコピーして実行

### 4. ローカル起動

```bash
npm run dev
# → http://localhost:3000
```

---

## Vercel デプロイ

### 1. GitHub にプッシュ

```bash
git add -A
git commit -m "feat: initial deployment"
git push origin master
```

### 2. Vercel プロジェクト作成

1. [Vercel](https://vercel.com) にログイン
2. **Add New Project** → GitHub リポジトリ `range-manager` を選択
3. **Root Directory**: そのまま（変更不要）
4. **Framework Preset**: Other

### 3. 環境変数設定

Vercel プロジェクト → Settings → Environment Variables に以下を追加:

```
GEMINI_API_KEY=...
DATABASE_URL=...
SECRET_KEY=...
CORS_ORIGIN=https://range-manager-demo.vercel.app
NODE_ENV=production
```

### 4. デプロイ

Settings → Git → Deploy ボタン、または `git push` で自動デプロイ。

### 5. Vercel Cron 設定確認

`vercel.json` に以下が含まれていることを確認（Vercel Pro プラン以上で有効）:

```json
"crons": [{ "path": "/birthday/run", "schedule": "0 0 * * *" }]
```

UTC 00:00 = JST 09:00 に `/birthday/run` が自動実行されます。

---

## 動作確認

### ヘルスチェック

```bash
curl https://your-app.vercel.app/health
```

### テナント登録

```bash
curl -X POST https://your-app.vercel.app/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"テスト練習場","email":"test@example.com","password":"password123"}'
```

### ログイン

```bash
curl -X POST https://your-app.vercel.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
# → { "success": true, "data": { "token": "eyJ...", "tenant": {...} } }
```

### 会員一覧（JWT必須）

```bash
TOKEN="eyJ..."
curl https://your-app.vercel.app/members/ \
  -H "Authorization: Bearer $TOKEN"
```

### 口コミ返信AI（SSEストリーミング）

```bash
curl -N -X POST https://your-app.vercel.app/reviews/{id}/generate-reply \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

### 誕生日送信（手動実行）

```bash
curl -X POST https://your-app.vercel.app/birthday/run \
  -H "Authorization: Bearer $TOKEN"
```

---

## API 一覧

| メソッド | パス | プラン | 機能 |
|---------|------|-------|------|
| POST | `/auth/register` | ー | テナント登録 |
| POST | `/auth/login` | ー | ログイン・JWT発行 |
| GET | `/auth/me` | JWT | ログイン情報 |
| GET/POST | `/members/` | 全プラン | 会員一覧・作成 |
| GET/PUT/DELETE | `/members/:id` | 全プラン | 会員操作 |
| GET/POST | `/reviews/` | standard+ | 口コミ一覧・登録 |
| PATCH | `/reviews/:id/reply` | standard+ | 返信保存 |
| POST | `/reviews/:id/generate-reply` | pro+ | AI返信SSE |
| POST | `/messages/generate` | standard+ | 配信文AI生成 |
| GET/POST | `/messages/log` | standard+ | 配信ログ |
| POST | `/campaigns/generate` | standard+ | キャンペーンAI |
| GET/POST | `/lessons/` | pro+ | レッスン予約 |
| PUT | `/lessons/:id` | pro+ | 予約更新 |
| POST | `/lessons/auto-reply` | pro+ | AI自動返信 |
| GET | `/bays/availability` | 全プラン | 打席空き確認 |
| GET/POST | `/bays/` | 全プラン | 打席予約 |
| PUT | `/bays/:id` | 全プラン | 予約ステータス変更 |
| GET/POST | `/birthday/run` | Cron/手動 | 誕生日送信 |

---

## プラン構成

| プラン | 価格 | 会員上限 |
|-------|------|---------|
| trial | 無料 | 50名 |
| standard | ¥9,800/月 | 500名 |
| pro | ¥19,800/月 | 無制限 |
| enterprise | 要相談 | 無制限 |

---

## 注意事項

- `SECRET_KEY` は本番では必ずランダムな32文字以上の値に変更すること
- `DATABASE_URL` は Supabase の Transaction pooler 接続文字列（ポート6543）を使用
- LINE送信は `birthday.js` にTODOが残っており、実装が必要
- Vercel Cron は Pro プラン以上が必要
