# FC申し込み管理アプリ — 引継ぎドキュメント

## プロジェクト概要
推し活のFCチケット申し込み調整・当落管理・公演記録を行うWebアプリ。
現在スプレッドシートで行っている運用をWebアプリに置き換える。
設計フェーズ完了。**次のステップは実装（Next.jsのscaffold）から。**

---

## ユーザー・名義構成

| ユーザー | 担当名義 | 備考 |
|---------|---------|------|
| Katsura | 名義A、名義C | 名義CはKatsuraが代理管理（本人は操作しない） |
| 友人B | 名義B、名義D | 病院ITインフラ担当、ITに長けている 名義Dは友人Bが代理管理（本人は操作しない） |

名義は稀に増える可能性あり。

---

## 技術スタック

| 役割 | 技術 |
|------|------|
| DB | Neon（PostgreSQL）— BPRシステムとは**別プロジェクト**で新規作成 |
| ORM | Drizzle + drizzle-kit |
| Frontend/API | Next.js（App Router）|
| Styling | Tailwind CSS |
| Hosting | Vercel |
| 画像解析 | Claude Vision API |
| 認証 | NextAuth.js（メール＋パスワード、2ユーザー固定） |
| LINE連携 | 将来対応（初期スコープ外） |

---

## データモデル

### Enums
```typescript
companionTiming:  "at_entry" | "before_show"
idVerification:   "none" | "face_auth" | "other"
companionType:    "fc_member" | "general_email" | "none"
lotteryResult:    "pending" | "won" | "lost"   // 補欠なし
paymentStatus:    "not_required" | "pending" | "completed"
```

### テーブル構成
```
members          名義マスタ
  id, label, name, fcMemberNumber,
  addressGroup,            -- 同住所グループ識別子（当選上限分析用）
  canPassIdVerification,   -- false=顔認証公演で使用不可（名義Cなど）
  isActive

productions      ツアー・演目マスタ
  id, title, artist,
  companionTiming,         -- at_entry / before_show
  idVerification,          -- none / face_auth / other
  allowsGeneralCompanion   -- 一般メアド同行可否

performances     公演日程（productionに紐付き）
  id, productionId, venue,
  performanceDate, startTime, dayOfWeek
  ※ (productionId, performanceDate, startTime, venue) にUNIQUE制約

entries          申し込みエントリ（performance × member）
  id, performanceId, memberId,
  companionType, companionMemberId, companionEmail,
  appliedAt,
  lotteryResult, resultNotifiedAt,
  paymentStatus, paidAt,
  seatInfo, ticketImageUrl
```

### Views（views.sql）
- **entries_with_ikkonzuri**：一本釣りフラグを動的計算
  （同一ツアー×同一名義のエントリが1件のみ = true）
- **lottery_analysis**：名義×ツアー×曜日別当落集計・当選率
- **member_involvement_summary**：名義ごとの申込回数・同行回数・当選回数
  （顔認証ツアーは申込名義・同行者どちらもカウントされる）

---

## 重要な業務ルール

### 一本釣り
「その名義がそのツアーで1公演のみ申し込む」＝当選確率MAX施策。
DBカラムは持たずViewで動的判定。エラーで弾かず情報表示のみ。

### 同行者登録タイミング
- `at_entry`（申込時必須）：同一ツアーで同一名義を同行者に重複指定不可
  → エラーで弾かずアラート表示のみ
- `before_show`（公演前でOK）：同行者の重複チェックなし。一本釣りで3公演申し込み可能

### 顔認証（`idVerification: "face_auth"`）
- `canPassIdVerification = false` の名義は使用不可 → アラート表示のみ（弾かない）
- 申込名義・同行者どちらの関与もカウントされる模様
- 顔認証ツアーでの申し込みパターン例：
  ```
  公演日1  名義A（申込）  名義B（同行）
  公演日2  名義B（申込）  名義A（同行）
  ※ 名義Aも名義Bも、どちらでもカウントされるためMax当選が2の場合どちらも上限に達してることになる模様。数に注意
  ```

### 当選上限
- 運営側のブラックボックス。事前に知る方法なし
- `maxWinsPerMember` 等のカラムは**持たない**
- 同住所名義（`addressGroup`）は当選1カウントとして扱われる可能性あり
- 分析Viewで事後把握するのみ

### 制作開放（突然の追加当選）
- 25年で約3回（3/400）のレアケース
- 落選 → 当選 へのエントリ詳細画面からの手動更新で対応

---

## 当落入力フロー

1. 当落はツアー単位で**一斉発表**（公演ごとではない）
2. 当選メールは**申込名義**に届く。同行者には届かない
3. 更新画面は**自分担当名義のエントリのみ表示**
   - Katsura → 名義A・Cのエントリのみ
   - B → 名義B・Dのエントリのみ
4. UI操作：**チェック＝当選、チェックなし＝落選**で一括保存
5. 通知に1回入力 → 全エントリに適用、ただし名義DやCなど適時に確認できないケースもあるため複数回の当落入力も可能とする

---

## 画面一覧

| # | 画面名 | 主な機能 |
|---|--------|---------|
| 1 | ダッシュボード | 直近の申し込み状況サマリ（申込中・当選・入金待ち件数） |
| 2 | 公演登録 | スクショアップロード→Vision API読み取り→ルール設定→保存 |
| 3 | 公演詳細 | 公演日程一覧＋エントリ状況 |
| 4 | エントリ作成 | 公演×名義×同行者の組み合わせ登録 |
| 5 | 当落一括入力 | 担当名義エントリにチェック→一括保存 |
| 6 | エントリ詳細 | 入金・座席の個別更新、制作開放対応 |
| 7 | 分析 | 名義×曜日×同行パターン別当落集計 |
| 8 | 過去半券取り込み | 画像→座席・公演情報DB化（後回し） |

---

## Vision API精度検証済み
- PCブラウザスクショ・スマホスクショ両レイアウトで問題なし
- 複数FCサイト（日生劇場、サンシャイン劇場）で確認済み
- 読み取りプロンプトは `src/db/import.ts` の `VISION_PROMPT` 定数に定義済み

---

## 既存成果物ファイル
設計フェーズで作成済み（`/outputs/fanclub-app/` に出力済み）：

```
src/db/schema.ts     Drizzleスキーマ定義
src/db/views.sql     分析View・一本釣りView SQL
src/db/import.ts     Vision APIプロンプト・日付変換ユーティリティ
drizzle.config.ts    Drizzle設定
README.md            技術スタック・セットアップ手順
```

---

## 次のステップ（実装開始）

1. `npx create-next-app fc-app --typescript --tailwind --app` でscaffold
2. Neonで新規プロジェクト作成 → `DATABASE_URL` 取得
3. Drizzle・NextAuthの依存パッケージインストール
4. `drizzle-kit generate` → `drizzle-kit migrate` でスキーマ適用
5. NextAuth設定（2ユーザー固定、メール＋パスワード）
6. **公演登録画面**（Vision API連携）から実装開始
