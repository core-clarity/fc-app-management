# おたくの現場

推し活のFCチケット申込調整・当落管理・公演記録を行うWebアプリ。

## 技術スタック

| 役割 | 技術 |
|------|------|
| DB | Neon（PostgreSQL）— BPRシステムとは別プロジェクト |
| ORM | Drizzle ORM + drizzle-kit |
| Frontend / API | Next.js 14（App Router） |
| Styling | Tailwind CSS |
| Hosting | Vercel |
| 画像解析 | Claude Vision API |
| 認証 | NextAuth.js v5（Credentials Provider） |

## STEP 1 — 基盤構築

### 1. Neon プロジェクト作成

1. https://console.neon.tech にログイン
2. **New Project** → プロジェクト名例: `fc-app-management`
3. Region は近いもの（例: `Asia Pacific (Singapore)`）を選択
4. 作成後、**Connection string**（PostgreSQL）をコピー
5. ローカルに `.env.local` を作成して貼り付け:

```bash
cp .env.example .env.local
```

```env
DATABASE_URL=postgresql://...@...neon.tech/neondb?sslmode=require
AUTH_SECRET=（下記で生成）
NEXTAUTH_URL=http://localhost:3000
ANTHROPIC_API_KEY=sk-ant-...
```

`AUTH_SECRET` の生成（PowerShell）:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

または Git Bash / WSL:

```bash
openssl rand -base64 32
```

### 2. 依存関係・マイグレーション

```bash
npm install
npx drizzle-kit generate
npx drizzle-kit migrate
```

### 3. Views の適用

マイグレーション後、Neon Console → **SQL Editor** に `src/db/views.sql` の内容を貼り付けて Run する。

## データモデル概要

```
users            NextAuth用ユーザー（2名固定）
members          名義マスタ（ownerUserId で担当ユーザー紐付け）
productions      ツアー・演目マスタ（申し込みルールを保持）
performances     公演日程（曜日カラムなし・SELECT時に計算）
entries          申し込みエントリ（performance × member UNIQUE）
```

### 重要な設計ポイント

- **一本釣り**はDBカラムではなく `entries_with_ikkonzuri` View で動的判定（エラーではなく情報表示）
- **lotteryResult** に補欠（waitlist）は持たない
- **dayOfWeek** は performances に持たず `to_char(performance_date, 'Dy')` で算出
- 業務ルール違反は基本的に弾かずアラート表示のみ

## STEP 2 — 認証・初期データ

```bash
npm run db:seed      # users / members を投入（idempotent）
npm run dev
```

`http://localhost:3000/login` からログインできます。

## npm scripts

```bash
npm run dev          # 開発サーバー
npm run db:generate  # マイグレーションSQL生成
npm run db:migrate   # スキーマ適用
npm run db:studio    # Drizzle Studio
npm run db:seed      # users / members シード
```

## 環境変数

```
DATABASE_URL=postgresql://...
AUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
ANTHROPIC_API_KEY=sk-ant-...
```
