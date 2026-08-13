import { auth } from "@/auth";
import { db } from "@/db";
import { toIsoTime } from "@/db/import";
import { performances, productions } from "@/db/schema";

export const runtime = "nodejs";

type CompanionTiming = "at_entry" | "before_show";
type IdVerification = "none" | "face_auth" | "other";

type PerformanceInput = {
  date: string;
  time: string;
};

type VenueInput = {
  venue: string;
  city?: string | null;
  performances: PerformanceInput[];
};

type CreateProductionBody = {
  title: string;
  artist: string;
  companionTiming: CompanionTiming;
  idVerification: IdVerification;
  allowsGeneralCompanion: boolean;
  venues: VenueInput[];
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function formatVenue(venue: string, city?: string | null): string {
  const v = venue.trim();
  const c = typeof city === "string" ? city.trim() : "";
  if (!c) return v;
  if (v.includes(c)) return v;
  return `${c}・${v}`;
}

type NormalizeResult =
  | { ok: true; data: CreateProductionBody }
  | { ok: false; error: string };

function normalizeBody(body: unknown): NormalizeResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "リクエスト本文が不正です。" };
  }

  const b = body as Record<string, unknown>;

  if (!isNonEmptyString(b.title)) {
    return { ok: false, error: "タイトルを入力してください。" };
  }
  if (!isNonEmptyString(b.artist)) {
    return { ok: false, error: "アーティスト名を入力してください。" };
  }

  const companionTiming = b.companionTiming;
  if (companionTiming !== "at_entry" && companionTiming !== "before_show") {
    return { ok: false, error: "同行者登録タイミングが不正です。" };
  }

  const idVerification = b.idVerification;
  if (
    idVerification !== "none" &&
    idVerification !== "face_auth" &&
    idVerification !== "other"
  ) {
    return { ok: false, error: "本人確認の設定が不正です。" };
  }

  if (typeof b.allowsGeneralCompanion !== "boolean") {
    return { ok: false, error: "一般同行者の可否が不正です。" };
  }

  if (!Array.isArray(b.venues) || b.venues.length === 0) {
    return { ok: false, error: "会場を1件以上追加してください。" };
  }

  const venues: VenueInput[] = [];

  for (let vi = 0; vi < b.venues.length; vi++) {
    const venueRaw = b.venues[vi];
    if (!venueRaw || typeof venueRaw !== "object") {
      return { ok: false, error: `会場${vi + 1}のデータが不正です。` };
    }
    const venueObj = venueRaw as Record<string, unknown>;
    if (!isNonEmptyString(venueObj.venue)) {
      return { ok: false, error: `会場${vi + 1}の会場名を入力してください。` };
    }
    if (!Array.isArray(venueObj.performances) || venueObj.performances.length === 0) {
      return {
        ok: false,
        error: `会場「${venueObj.venue}」に公演日程を1件以上追加してください。`,
      };
    }

    const perfs: PerformanceInput[] = [];
    for (let pi = 0; pi < venueObj.performances.length; pi++) {
      const perfRaw = venueObj.performances[pi];
      if (!perfRaw || typeof perfRaw !== "object") {
        return {
          ok: false,
          error: `会場「${venueObj.venue}」の公演${pi + 1}が不正です。`,
        };
      }
      const perf = perfRaw as Record<string, unknown>;
      if (!isNonEmptyString(perf.date) || !/^\d{4}-\d{2}-\d{2}$/.test(perf.date)) {
        return {
          ok: false,
          error: `会場「${venueObj.venue}」の公演${pi + 1}の日付は YYYY-MM-DD で入力してください。`,
        };
      }
      const timeMatch = isNonEmptyString(perf.time)
        ? perf.time.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
        : null;
      if (!timeMatch) {
        return {
          ok: false,
          error: `会場「${venueObj.venue}」の公演${pi + 1}の時刻は HH:MM で入力してください。`,
        };
      }
      const time = `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
      perfs.push({ date: perf.date, time });
    }

    venues.push({
      venue: venueObj.venue.trim(),
      city: typeof venueObj.city === "string" ? venueObj.city : null,
      performances: perfs,
    });
  }

  return {
    ok: true,
    data: {
      title: b.title.trim(),
      artist: b.artist.trim(),
      companionTiming,
      idVerification,
      allowsGeneralCompanion: b.allowsGeneralCompanion,
      venues,
    },
  };
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "JSON の解析に失敗しました。" }, { status: 400 });
  }

  const normalized = normalizeBody(raw);
  if (!normalized.ok) {
    return Response.json({ error: normalized.error }, { status: 400 });
  }

  const body = normalized.data;

  try {
    const [production] = await db
      .insert(productions)
      .values({
        title: body.title,
        artist: body.artist,
        companionTiming: body.companionTiming,
        idVerification: body.idVerification,
        allowsGeneralCompanion: body.allowsGeneralCompanion,
      })
      .returning();

    const performanceRows = body.venues.flatMap((venue) =>
      venue.performances.map((perf) => ({
        productionId: production.id,
        venue: formatVenue(venue.venue, venue.city),
        performanceDate: perf.date,
        startTime: toIsoTime(perf.time),
      }))
    );

    const insertedPerformances = await db
      .insert(performances)
      .values(performanceRows)
      .returning();

    return Response.json({
      production,
      performances: insertedPerformances,
    });
  } catch (error) {
    console.error("Create production error:", error);
    const message =
      error instanceof Error ? error.message : "公演の保存に失敗しました。";
    return Response.json({ error: message }, { status: 500 });
  }
}
