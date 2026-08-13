/**
 * 過去半券 JSON を past_attendances へ idempotent 投入する。
 *
 * 用法: npm run db:import-past
 * 入力: 過去半券_焼込済/*.json
 * 冪等キー: (ownerUserId, sourceType=json_import, sourceImageIndex)
 */
import { config as loadEnv } from "dotenv";
import fs from "fs";
import path from "path";
import { and, eq } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/db/schema";
import { PAST_OWNER_EMAIL } from "../src/lib/past-owner";

loadEnv({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in .env.local");
}

const INPUT_DIR = path.resolve("過去半券_焼込済");
const OWNER_EMAIL = PAST_OWNER_EMAIL;
const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql, { schema });

type PastGenre = "concert" | "stage" | "other";

type PastJsonRow = {
  imageIndex?: string | null;
  sourceFile?: string | null;
  artist?: string | null;
  title?: string | null;
  venue?: string | null;
  city?: string | null;
  performanceDate?: string | null;
  startTime?: string | null;
  seatInfo?: string | null;
  price?: number | null;
  genre?: string | null;
  notes?: string | null;
};

function isPastGenre(value: string): value is PastGenre {
  return value === "concert" || value === "stage" || value === "other";
}

function normalizeTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  // HH:MM → HH:MM:00（Postgres time）
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [h, m] = trimmed.split(":");
    return `${h.padStart(2, "0")}:${m}:00`;
  }
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(trimmed)) {
    const [h, m, s] = trimmed.split(":");
    return `${h.padStart(2, "0")}:${m}:${s}`;
  }
  return trimmed;
}

async function resolveOwnerUserId(): Promise<string> {
  const owner = await db.query.users.findFirst({
    where: eq(schema.users.email, OWNER_EMAIL),
  });
  if (!owner) {
    throw new Error(
      `Owner user not found: ${OWNER_EMAIL}. Run npm run db:seed first.`
    );
  }
  return owner.id;
}

function listJsonFiles(): string[] {
  if (!fs.existsSync(INPUT_DIR)) {
    throw new Error(`Input directory not found: ${INPUT_DIR}`);
  }
  return fs
    .readdirSync(INPUT_DIR)
    .filter((name) => name.toLowerCase().endsWith(".json"))
    .sort()
    .map((name) => path.join(INPUT_DIR, name));
}

function readRows(filePath: string): PastJsonRow[] {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected JSON array: ${filePath}`);
  }
  return parsed as PastJsonRow[];
}

async function upsertRow(
  ownerUserId: string,
  row: PastJsonRow,
  fallbackSourceFile: string
): Promise<"inserted" | "skipped"> {
  const imageIndex = row.imageIndex?.trim();
  if (!imageIndex) {
    console.warn(`skip: missing imageIndex in ${fallbackSourceFile}`);
    return "skipped";
  }

  const title = row.title?.trim();
  if (!title) {
    console.warn(`skip: missing title (${imageIndex})`);
    return "skipped";
  }

  const genreRaw = row.genre?.trim() ?? "";
  if (!isPastGenre(genreRaw)) {
    console.warn(`skip: invalid genre "${row.genre}" (${imageIndex})`);
    return "skipped";
  }

  const values = {
    ownerUserId,
    artist: row.artist?.trim() || null,
    title,
    venue: row.venue?.trim() || null,
    city: row.city?.trim() || null,
    performanceDate: row.performanceDate?.trim() || null,
    startTime: normalizeTime(row.startTime),
    seatInfo: row.seatInfo?.trim() || null,
    price: typeof row.price === "number" ? row.price : null,
    genre: genreRaw,
    oshiId: null as string | null,
    topic: null as string | null,
    sourceType: "json_import" as const,
    sourceImageIndex: imageIndex,
    sourceFile: row.sourceFile?.trim() || fallbackSourceFile,
    sourceEntryId: null as string | null,
    notes: row.notes?.trim() || null,
    updatedAt: new Date(),
  };

  const existing = await db.query.pastAttendances.findFirst({
    where: and(
      eq(schema.pastAttendances.ownerUserId, ownerUserId),
      eq(schema.pastAttendances.sourceType, "json_import"),
      eq(schema.pastAttendances.sourceImageIndex, imageIndex)
    ),
  });

  if (existing) {
    // 手修正を潰さない。再実行は新規 imageIndex のみ追加
    return "skipped";
  }

  await db.insert(schema.pastAttendances).values(values);
  return "inserted";
}

async function main() {
  const ownerUserId = await resolveOwnerUserId();
  const files = listJsonFiles();
  if (files.length === 0) {
    console.log(`No JSON files in ${INPUT_DIR}`);
    return;
  }

  let inserted = 0;
  let skipped = 0;

  console.log(`Owner: ${OWNER_EMAIL} (${ownerUserId})`);
  console.log(`Files: ${files.length}`);

  for (const filePath of files) {
    const base = path.basename(filePath);
    const rows = readRows(filePath);
    console.log(`\n${base}: ${rows.length} rows`);

    for (const row of rows) {
      const result = await upsertRow(ownerUserId, row, base);
      if (result === "inserted") inserted += 1;
      else skipped += 1;
    }
  }

  console.log("\nImport completed (insert new keys only; existing skipped).");
  console.log(
    JSON.stringify({ inserted, skipped, files: files.length }, null, 2)
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
