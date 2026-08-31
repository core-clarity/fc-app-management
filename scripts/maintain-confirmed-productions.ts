/**
 * 確認済み公演の限定メンテナンス。
 *
 * - テスト公演はタイトル完全一致で削除する
 * - 関連エントリ、日程、公演の順で削除する
 * - 過去観覧ログから参照されている場合は削除を中止する
 * - ザ・ミュージック・マンの一般同行を許可する
 */
import { config as loadEnv } from "dotenv";
import { and, eq, inArray } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/db/schema";

loadEnv({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in .env.local");
}

const db = drizzle(neon(process.env.DATABASE_URL), { schema });

const TEST_PRODUCTION_TITLE =
  "ヨーロッパ企画特別興行「世界の終わりかけとスリーコード」";
const MUSIC_MAN_TITLE = "ザ・ミュージック・マン";
const MUSIC_MAN_ARTIST = "坂本昌行";

async function main() {
  const testProductions = await db
    .select({ id: schema.productions.id })
    .from(schema.productions)
    .where(eq(schema.productions.title, TEST_PRODUCTION_TITLE));
  const testProductionIds = testProductions.map((production) => production.id);

  const performanceRows =
    testProductionIds.length > 0
      ? await db
          .select({ id: schema.performances.id })
          .from(schema.performances)
          .where(inArray(schema.performances.productionId, testProductionIds))
      : [];
  const performanceIds = performanceRows.map((performance) => performance.id);

  const entryRows =
    performanceIds.length > 0
      ? await db
          .select({ id: schema.entries.id })
          .from(schema.entries)
          .where(inArray(schema.entries.performanceId, performanceIds))
      : [];
  const entryIds = entryRows.map((entry) => entry.id);

  if (entryIds.length > 0) {
    const pastReferences = await db
      .select({ id: schema.pastAttendances.id })
      .from(schema.pastAttendances)
      .where(inArray(schema.pastAttendances.sourceEntryId, entryIds));
    if (pastReferences.length > 0) {
      throw new Error(
        `削除中止: テスト公演のエントリが過去観覧ログから${pastReferences.length}件参照されています。`
      );
    }
  }

  const musicManProductions = await db
    .select({ id: schema.productions.id })
    .from(schema.productions)
    .where(
      and(
        eq(schema.productions.title, MUSIC_MAN_TITLE),
        eq(schema.productions.artist, MUSIC_MAN_ARTIST)
      )
    );
  if (musicManProductions.length !== 1) {
    throw new Error(
      `ザ・ミュージック・マンの対象公演が一意に特定できません（${musicManProductions.length}件）。`
    );
  }

  if (entryIds.length > 0) {
    await db
      .delete(schema.entries)
      .where(inArray(schema.entries.id, entryIds));
  }
  if (performanceIds.length > 0) {
    await db
      .delete(schema.performances)
      .where(inArray(schema.performances.id, performanceIds));
  }
  if (testProductionIds.length > 0) {
    await db
      .delete(schema.productions)
      .where(inArray(schema.productions.id, testProductionIds));
  }

  await db
    .update(schema.productions)
    .set({ allowsGeneralCompanion: true })
    .where(eq(schema.productions.id, musicManProductions[0].id));

  const result = {
    deletedProductions: testProductions.length,
    deletedPerformances: performanceIds.length,
    deletedEntries: entryIds.length,
    generalCompanionUpdated: true,
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
