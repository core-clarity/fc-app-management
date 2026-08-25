import {
  pgTable,
  text,
  boolean,
  timestamp,
  pgEnum,
  uuid,
  date,
  time,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// -----------------------------------------------
// Enums
// -----------------------------------------------

/** 同行者登録タイミング */
export const companionTimingEnum = pgEnum("companion_timing", [
  "at_entry", // 申込時に同行者を登録
  "before_show", // 公演前までに登録すればOK
]);

/** 本人確認レベル */
export const idVerificationEnum = pgEnum("id_verification", [
  "none",
  "face_auth",
  "other",
]);

/** 同行者タイプ */
export const companionTypeEnum = pgEnum("companion_type", [
  "fc_member",
  "general_email",
  "none",
]);

/** 当落結果（補欠ステータスなし） */
export const lotteryResultEnum = pgEnum("lottery_result", [
  "pending",
  "won",
  "lost",
]);

/** 入金状況 */
export const paymentStatusEnum = pgEnum("payment_status", [
  "not_required",
  "pending",
  "completed",
]);

/** 過去観覧のジャンル */
export const pastGenreEnum = pgEnum("past_genre", [
  "concert",
  "stage",
  "other",
]);

/** 過去観覧の流入元 */
export const pastSourceTypeEnum = pgEnum("past_source_type", [
  "json_import",
  "entry_copy",
  "manual",
]);

// -----------------------------------------------
// NextAuth 用ユーザー
// -----------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
});

// -----------------------------------------------
// 名義マスタ
// -----------------------------------------------

export const members = pgTable("members", {
  id: uuid("id").primaryKey().defaultRandom(),
  // 過去半券用ダミー名義は NULL
  ownerUserId: uuid("owner_user_id").references(() => users.id),
  label: text("label").notNull(), // "名義A" など表示ラベル
  name: text("name").notNull(), // 実名
  fcMemberNumber: text("fc_member_number"),
  addressGroup: text("address_group"), // 同住所グループ識別子（当選上限分析用）
  canPassIdVerification: boolean("can_pass_id_verification")
    .notNull()
    .default(true),
  isActive: boolean("is_active").notNull().default(true),
  symbol: text("symbol"), // カタログキー: cat | cra | cup | hit | crescent
  themeColor: text("theme_color"), // 例: '#F472B6'
});

// -----------------------------------------------
// ツアー / 演目マスタ
// -----------------------------------------------

export const productions = pgTable("productions", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  companionTiming: companionTimingEnum("companion_timing").notNull(),
  idVerification: idVerificationEnum("id_verification")
    .notNull()
    .default("none"),
  allowsGeneralCompanion: boolean("allows_general_companion")
    .notNull()
    .default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// -----------------------------------------------
// 公演日程
// dayOfWeek は持たない。SELECT 時に to_char(performance_date, 'Dy') で計算
// -----------------------------------------------

export const performances = pgTable(
  "performances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productionId: uuid("production_id")
      .notNull()
      .references(() => productions.id, { onDelete: "cascade" }),
    venue: text("venue").notNull(),
    performanceDate: date("performance_date").notNull(),
    startTime: time("start_time").notNull(),
  },
  (table) => ({
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

export const entries = pgTable(
  "entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    performanceId: uuid("performance_id")
      .notNull()
      .references(() => performances.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),

    companionType: companionTypeEnum("companion_type")
      .notNull()
      .default("fc_member"),
    companionMemberId: uuid("companion_member_id").references(() => members.id),
    companionEmail: text("companion_email"),

    appliedAt: timestamp("applied_at").notNull().defaultNow(),
    lotteryResult: lotteryResultEnum("lottery_result")
      .notNull()
      .default("pending"),
    resultNotifiedAt: timestamp("result_notified_at"),

    paymentStatus: paymentStatusEnum("payment_status")
      .notNull()
      .default("not_required"),
    paidAt: timestamp("paid_at"),

    seatInfo: text("seat_info"),
    ticketImageUrl: text("ticket_image_url"),
  },
  (table) => ({
    uniqueEntry: uniqueIndex("unique_entry").on(
      table.performanceId,
      table.memberId
    ),
  })
);

// -----------------------------------------------
// 推しマスタ（過去分析チャート用）
// -----------------------------------------------

export const oshiArtists = pgTable("oshi_artists", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull().unique(),
  themeColor: text("theme_color").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

// -----------------------------------------------
// アーティスト色マスタ（券面表記 past_attendances.artist と一致）
// 表記ゆれは別行で同じ色を持つ
// -----------------------------------------------

export const artistThemes = pgTable("artist_themes", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull().unique(),
  themeColor: text("theme_color").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// -----------------------------------------------
// 過去観覧ログ（Katsura 個人の生涯ログ）
// -----------------------------------------------

export const pastAttendances = pgTable(
  "past_attendances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id),
    artist: text("artist"),
    title: text("title").notNull(),
    venue: text("venue"),
    city: text("city"),
    performanceDate: date("performance_date"),
    startTime: time("start_time"),
    seatInfo: text("seat_info"),
    price: integer("price"),
    genre: pastGenreEnum("genre").notNull(),
    oshiId: uuid("oshi_id").references(() => oshiArtists.id),
    topic: text("topic"),
    sourceType: pastSourceTypeEnum("source_type").notNull(),
    sourceImageIndex: text("source_image_index"),
    sourceFile: text("source_file"),
    sourceEntryId: uuid("source_entry_id").references(() => entries.id),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    // JSON import の冪等キー（再実行で倍増しない）
    uniqueJsonImport: uniqueIndex("unique_past_json_import").on(
      table.ownerUserId,
      table.sourceType,
      table.sourceImageIndex
    ),
    // entry Copy の重複防止
    uniqueEntryCopy: uniqueIndex("unique_past_entry_copy").on(
      table.sourceEntryId
    ),
  })
);

// -----------------------------------------------
// Relations
// -----------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  members: many(members),
  pastAttendances: many(pastAttendances),
}));

export const membersRelations = relations(members, ({ one, many }) => ({
  ownerUser: one(users, {
    fields: [members.ownerUserId],
    references: [users.id],
  }),
  entries: many(entries, { relationName: "member_entries" }),
  companionEntries: many(entries, { relationName: "companion_entries" }),
}));

export const productionsRelations = relations(productions, ({ many }) => ({
  performances: many(performances),
}));

export const performancesRelations = relations(
  performances,
  ({ one, many }) => ({
    production: one(productions, {
      fields: [performances.productionId],
      references: [productions.id],
    }),
    entries: many(entries),
  })
);

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

export const oshiArtistsRelations = relations(oshiArtists, ({ many }) => ({
  pastAttendances: many(pastAttendances),
}));

export const pastAttendancesRelations = relations(
  pastAttendances,
  ({ one }) => ({
    ownerUser: one(users, {
      fields: [pastAttendances.ownerUserId],
      references: [users.id],
    }),
    oshi: one(oshiArtists, {
      fields: [pastAttendances.oshiId],
      references: [oshiArtists.id],
    }),
    sourceEntry: one(entries, {
      fields: [pastAttendances.sourceEntryId],
      references: [entries.id],
    }),
  })
);

// -----------------------------------------------
// 型エクスポート
// -----------------------------------------------

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;

export type Production = typeof productions.$inferSelect;
export type NewProduction = typeof productions.$inferInsert;

export type Performance = typeof performances.$inferSelect;
export type NewPerformance = typeof performances.$inferInsert;

export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;

export type OshiArtist = typeof oshiArtists.$inferSelect;
export type NewOshiArtist = typeof oshiArtists.$inferInsert;

export type ArtistTheme = typeof artistThemes.$inferSelect;
export type NewArtistTheme = typeof artistThemes.$inferInsert;

export type PastAttendance = typeof pastAttendances.$inferSelect;
export type NewPastAttendance = typeof pastAttendances.$inferInsert;
