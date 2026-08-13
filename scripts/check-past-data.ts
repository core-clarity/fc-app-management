/**
 * 過去半券 JSON / DB のチェックサマリ
 * 用法: npx tsx scripts/check-past-data.ts
 */
import { config as loadEnv } from "dotenv";
import fs from "fs";
import path from "path";
import { eq, sql } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/db/schema";
import { PAST_OWNER_EMAIL } from "../src/lib/past-owner";
import { artistLabel } from "../src/lib/past-analytics";

loadEnv({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const INPUT_DIR = path.resolve("過去半券_焼込済");
const db = drizzle(neon(process.env.DATABASE_URL), { schema });

type Row = Record<string, unknown>;

function listJsonFiles(): string[] {
  return fs
    .readdirSync(INPUT_DIR)
    .filter((n) => n.toLowerCase().endsWith(".json"))
    .sort((a, b) => {
      const na = Number(a.replace(/\.json$/i, ""));
      const nb = Number(b.replace(/\.json$/i, ""));
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return a.localeCompare(b);
    })
    .map((n) => path.join(INPUT_DIR, n));
}

function topN(map: Map<string, number>, n: number) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}

async function main() {
  // ---- JSON 側 ----
  const files = listJsonFiles();
  let jsonRows = 0;
  let jsonMissingTitle = 0;
  let jsonDupImageIndex = 0;
  const imageIndexSeen = new Map<string, string>();
  const perFile: Array<{ file: string; rows: number; missingTitle: number }> =
    [];

  for (const filePath of files) {
    const base = path.basename(filePath);
    const rows = JSON.parse(fs.readFileSync(filePath, "utf8")) as Row[];
    if (!Array.isArray(rows)) {
      console.warn(`skip non-array: ${base}`);
      continue;
    }
    let missingTitle = 0;
    for (const row of rows) {
      jsonRows += 1;
      const idx = String(row.imageIndex ?? "").trim();
      if (idx) {
        if (imageIndexSeen.has(idx)) jsonDupImageIndex += 1;
        else imageIndexSeen.set(idx, base);
      }
      if (!String(row.title ?? "").trim()) {
        missingTitle += 1;
        jsonMissingTitle += 1;
      }
    }
    perFile.push({ file: base, rows: rows.length, missingTitle });
  }

  // ---- DB 側 ----
  const owner = await db.query.users.findFirst({
    where: eq(schema.users.email, PAST_OWNER_EMAIL),
  });
  if (!owner) throw new Error("owner not found");

  const dbRows = await db
    .select({
      artist: schema.pastAttendances.artist,
      venue: schema.pastAttendances.venue,
      city: schema.pastAttendances.city,
      performanceDate: schema.pastAttendances.performanceDate,
      price: schema.pastAttendances.price,
      genre: schema.pastAttendances.genre,
      seatInfo: schema.pastAttendances.seatInfo,
      title: schema.pastAttendances.title,
    })
    .from(schema.pastAttendances)
    .where(eq(schema.pastAttendances.ownerUserId, owner.id));

  const artistCounts = new Map<string, number>();
  const venueCounts = new Map<string, number>();
  const yearCounts = new Map<string, number>();
  const genreCounts = new Map<string, number>();
  let nullArtist = 0;
  let nullVenue = 0;
  let nullPrice = 0;
  let nullDate = 0;
  let nullSeat = 0;
  let priceSum = 0;

  for (const r of dbRows) {
    const a = artistLabel(r.artist);
    artistCounts.set(a, (artistCounts.get(a) ?? 0) + 1);
    if (!r.artist?.trim()) nullArtist += 1;

    const v = r.venue?.trim() || "不明";
    venueCounts.set(v, (venueCounts.get(v) ?? 0) + 1);
    if (!r.venue?.trim()) nullVenue += 1;

    if (r.price == null) nullPrice += 1;
    else priceSum += r.price;

    if (!r.performanceDate) nullDate += 1;
    else {
      const y = r.performanceDate.slice(0, 4);
      yearCounts.set(y, (yearCounts.get(y) ?? 0) + 1);
    }

    if (!r.seatInfo?.trim()) nullSeat += 1;
    genreCounts.set(r.genre, (genreCounts.get(r.genre) ?? 0) + 1);
  }

  // 名割れ候補: 大文字小文字・空白正規化すると衝突する表記
  const normalized = new Map<string, Set<string>>();
  for (const name of Array.from(artistCounts.keys())) {
    if (name === "不明") continue;
    const key = name.replace(/\s+/g, "").toLowerCase();
    const set = normalized.get(key) ?? new Set<string>();
    set.add(name);
    normalized.set(key, set);
  }
  const nameSplitCandidates = Array.from(normalized.entries())
    .filter(([, set]) => set.size > 1)
    .map(([key, set]) => ({
      key,
      variants: Array.from(set),
      counts: Array.from(set).map((v) => ({
        name: v,
        count: artistCounts.get(v) ?? 0,
      })),
    }));

  const summary = {
    json: {
      files: files.length,
      fileList: perFile,
      totalRows: jsonRows,
      missingTitle: jsonMissingTitle,
      duplicateImageIndexInJson: jsonDupImageIndex,
    },
    db: {
      totalShows: dbRows.length,
      nullArtist,
      nullVenue,
      nullPrice,
      nullDate,
      nullSeat,
      priceSum,
      artistVariantCount: artistCounts.size,
      genreCounts: Object.fromEntries(genreCounts),
      yearRange: Array.from(yearCounts.keys()).sort(),
      yearCounts: Object.fromEntries(
        Array.from(yearCounts.entries()).sort(([a], [b]) => a.localeCompare(b))
      ),
      topArtists: topN(artistCounts, 20),
      topVenues: topN(venueCounts, 15),
      nameSplitCandidates,
    },
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
