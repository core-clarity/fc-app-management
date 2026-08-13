import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  pgEnum,
  uuid,
  date,
  time,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// -----------------------------------------------
// Enums
// -----------------------------------------------

/** 同行者登録タイミング */
export const companionTimingEnum = pgEnum("companion_timing", [
  "at_entry",   // 申込時に同行者IDを登録する必要あり
  "before_show", // 公演前日までに登録すればOK
]);

/** 本人確認レベル */
export const idVerificationEnum = pgEnum("id_verification", [
  "none",         // 本人確認なし
  "face_auth",    // 顔認証
  "other",        // 住所暗唱など その他
]);

/** 同行者タイプ */
export const companionTypeEnum = pgEnum("companion_type", [
  "fc_member",    // FC名義（A/B/C）
  "general_email", // 一般メールアドレス
  "none",         // 同行者なし（一本釣り）
]);

/** 当落結果 */
export const lotteryResultEnum = pgEnum("lottery_result", [
  "pending",    // 未発表
  "won",        // 当選
  "lost",       // 落選
  "waitlist",   // 補欠
]);

/** 入金状況 */
export const paymentStatusEnum = pgEnum("payment_status", [
  "not_required", // 入金不要（落選 or 未当選）
  "pending",      // 入金待ち
  "completed",    // 入金完了
]);

// -----------------------------------------------
// 名義マスタ
// -----------------------------------------------

export const members = pgTable("members", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull(),               // "A" / "B" / "C" など
  name: text("name").notNull(),                 // 実名
  fcMemberNumber: text("fc_member_number"),     // FC会員番号
  addressGroup: text("address_group"),          // 同住所グループ識別子（例: "group1"）
  canPassIdVerification: boolean("can_pass_id_verification").notNull().default(true),
  // false = 本人確認が必要な公演では使用不可（名義Cのようなケース）
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// -----------------------------------------------
// ツアー / 演目マスタ
// -----------------------------------------------

export const productions = pgTable("productions", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),               // "ファニー・ガール" など
  artist: text("artist"),                       // 出演者・アーティスト名
  
  // 申し込みルール（ツアー・演目単位で固定）
  companionTiming: companionTimingEnum("companion_timing").notNull(),
  idVerification: idVerificationEnum("id_verification").notNull().default("none"),
  allowsGeneralCompanion: boolean("allows_general_companion").notNull().default(false),
  // true = 一般メアドで同行者登録可能

  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// -----------------------------------------------
// 公演日程
// -----------------------------------------------

export const performances = pgTable(
  "performances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productionId: uuid("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    venue: text("venue").notNull(),             // "日生劇場" など
    performanceDate: date("performance_date").notNull(),
    startTime: time("start_time").notNull(),    // "13:00" / "18:00"
    // 曜日はperformanceDateから導出できるがクエリ利便性のため持つ
    dayOfWeek: text("day_of_week").notNull(),   // "火" / "水・祝" など（画面表示用）
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    // 同一公演・同一日時の重複登録防止
    uniquePerformance: uniqueIndex("unique_performance").on(
      table.productionId,
      table.performanceDate,
      table.startTime,
      table.venue
    ),
  })
);

// -----------------------------------------------
// 申し込みエントリ
// -----------------------------------------------

export const entries = pgTable("entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  performanceId: uuid("performance_id")
    .notNull()
    .references(() => performances.id, { onDelete: "cascade" }),

  // 申し込み名義
  memberId: uuid("member_id")
    .notNull()
    .references(() => members.id),

  // 同行者設定
  companionType: companionTypeEnum("companion_type").notNull().default("none"),
  companionMemberId: uuid("companion_member_id")
    .references(() => members.id),        // companionType = "fc_member" のとき使用
  companionEmail: text("companion_email"), // companionType = "general_email" のとき使用

  // 申し込み状況
  appliedAt: timestamp("applied_at"),     // null = 未申込
  
  // 当落
  lotteryResult: lotteryResultEnum("lottery_result").notNull().default("pending"),
  resultNotifiedAt: timestamp("result_notified_at"),

  // 入金
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("not_required"),
  paidAt: timestamp("paid_at"),

  // 座席（当選後に追記）
  seatInfo: text("seat_info"),            // "A列 5番" など自由記述
  ticketImageUrl: text("ticket_image_url"), // チケット画像のURL

  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// -----------------------------------------------
// Relations
// -----------------------------------------------

export const productionsRelations = relations(productions, ({ many }) => ({
  performances: many(performances),
}));

export const performancesRelations = relations(performances, ({ one, many }) => ({
  production: one(productions, {
    fields: [performances.productionId],
    references: [productions.id],
  }),
  entries: many(entries),
}));

export const membersRelations = relations(members, ({ many }) => ({
  entries: many(entries, { relationName: "member_entries" }),
  companionEntries: many(entries, { relationName: "companion_entries" }),
}));

export const entriesRelations = relations(entries, ({ one }) => ({
  performance: one(performances, {
    fields: [entries.performanceId],
    references: [performances.id],
  }),
  member: one(members, {
    fields: [entries.memberId],
    references: [members.id],
    relationName: "member_entries",
  }),
  companionMember: one(members, {
    fields: [entries.companionMemberId],
    references: [members.id],
    relationName: "companion_entries",
  }),
}));

// -----------------------------------------------
// 型エクスポート
// -----------------------------------------------

export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;

export type Production = typeof productions.$inferSelect;
export type NewProduction = typeof productions.$inferInsert;

export type Performance = typeof performances.$inferSelect;
export type NewPerformance = typeof performances.$inferInsert;

export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;
