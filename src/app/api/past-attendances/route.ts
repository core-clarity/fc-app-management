import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { oshiArtists, pastAttendances } from "@/db/schema";
import { isPastOwnerEmail, resolvePastOwnerUserId } from "@/lib/past-auth";

export const runtime = "nodejs";

const GENRES = new Set(["concert", "stage", "other"]);

function nullIfBlank(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length ? t : null;
}

function parseGenre(value: unknown): "concert" | "stage" | "other" | null {
  if (typeof value !== "string") return null;
  return GENRES.has(value) ? (value as "concert" | "stage" | "other") : null;
}

function parsePrice(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(/,/g, ""));
    if (Number.isFinite(n)) return Math.round(n);
  }
  return undefined;
}

function normalizeTime(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
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

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await resolvePastOwnerUserId();
  if (!ownerId) {
    return Response.json({ error: "過去ログの持ち主が見つかりません。" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const filter = searchParams.get("filter") ?? "all";
  // filter: all | artist_null | venue_null | price_null | date_null

  const conditions = [eq(pastAttendances.ownerUserId, ownerId)];

  if (filter === "artist_null") {
    conditions.push(
      sql`(${pastAttendances.artist} is null or btrim(${pastAttendances.artist}) = '')`
    );
  } else if (filter === "venue_null") {
    conditions.push(
      sql`(${pastAttendances.venue} is null or btrim(${pastAttendances.venue}) = '')`
    );
  } else if (filter === "price_null") {
    conditions.push(sql`${pastAttendances.price} is null`);
  } else if (filter === "date_null") {
    conditions.push(sql`${pastAttendances.performanceDate} is null`);
  }

  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      or(
        ilike(pastAttendances.title, pattern),
        ilike(pastAttendances.artist, pattern),
        ilike(pastAttendances.venue, pattern),
        ilike(pastAttendances.city, pattern),
        ilike(pastAttendances.notes, pattern)
      )!
    );
  }

  const rows = await db
    .select({
      id: pastAttendances.id,
      artist: pastAttendances.artist,
      title: pastAttendances.title,
      venue: pastAttendances.venue,
      city: pastAttendances.city,
      performanceDate: pastAttendances.performanceDate,
      startTime: pastAttendances.startTime,
      seatInfo: pastAttendances.seatInfo,
      price: pastAttendances.price,
      genre: pastAttendances.genre,
      oshiId: pastAttendances.oshiId,
      topic: pastAttendances.topic,
      sourceType: pastAttendances.sourceType,
      sourceImageIndex: pastAttendances.sourceImageIndex,
      sourceFile: pastAttendances.sourceFile,
      notes: pastAttendances.notes,
      updatedAt: pastAttendances.updatedAt,
    })
    .from(pastAttendances)
    .where(and(...conditions))
    .orderBy(
      sql`${pastAttendances.performanceDate} desc nulls last`,
      desc(pastAttendances.updatedAt)
    );

  const oshiList = await db
    .select({
      id: oshiArtists.id,
      label: oshiArtists.label,
      themeColor: oshiArtists.themeColor,
    })
    .from(oshiArtists)
    .where(eq(oshiArtists.isActive, true))
    .orderBy(asc(oshiArtists.sortOrder));

  // 名寄せ候補（artist / venue の生値カウント）
  const allForRename = await db
    .select({
      artist: pastAttendances.artist,
      venue: pastAttendances.venue,
    })
    .from(pastAttendances)
    .where(eq(pastAttendances.ownerUserId, ownerId));

  const artistCounts = new Map<string, number>();
  const venueCounts = new Map<string, number>();
  for (const r of allForRename) {
    const a = r.artist?.trim();
    if (a) artistCounts.set(a, (artistCounts.get(a) ?? 0) + 1);
    const v = r.venue?.trim();
    if (v) venueCounts.set(v, (venueCounts.get(v) ?? 0) + 1);
  }

  const toRanked = (m: Map<string, number>) =>
    Array.from(m.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
      .map(([name, count]) => ({ name, count }));

  return Response.json({
    canEdit: isPastOwnerEmail(session.user.email),
    rows,
    oshiList,
    renameHints: {
      artists: toRanked(artistCounts),
      venues: toRanked(venueCounts),
    },
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPastOwnerEmail(session.user.email)) {
    return Response.json({ error: "過去データの編集権限がありません。" }, { status: 403 });
  }

  const ownerId = await resolvePastOwnerUserId();
  if (!ownerId) {
    return Response.json({ error: "過去ログの持ち主が見つかりません。" }, { status: 500 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "JSON の解析に失敗しました。" }, { status: 400 });
  }
  if (!raw || typeof raw !== "object") {
    return Response.json({ error: "リクエスト本文が不正です。" }, { status: 400 });
  }
  const body = raw as Record<string, unknown>;

  const title = nullIfBlank(body.title);
  if (!title) {
    return Response.json({ error: "title は必須です。" }, { status: 400 });
  }
  const genre = parseGenre(body.genre);
  if (!genre) {
    return Response.json({ error: "genre が不正です。" }, { status: 400 });
  }
  const price = parsePrice(body.price);
  if (price === undefined && body.price !== undefined && body.price !== null && body.price !== "") {
    return Response.json({ error: "price が不正です。" }, { status: 400 });
  }

  const [inserted] = await db
    .insert(pastAttendances)
    .values({
      ownerUserId: ownerId,
      artist: nullIfBlank(body.artist),
      title,
      venue: nullIfBlank(body.venue),
      city: nullIfBlank(body.city),
      performanceDate: nullIfBlank(body.performanceDate),
      startTime: normalizeTime(nullIfBlank(body.startTime)),
      seatInfo: nullIfBlank(body.seatInfo),
      price: price === undefined ? null : price,
      genre,
      oshiId: nullIfBlank(body.oshiId),
      topic: nullIfBlank(body.topic),
      sourceType: "manual",
      sourceImageIndex: null,
      sourceFile: null,
      sourceEntryId: null,
      notes: nullIfBlank(body.notes),
      updatedAt: new Date(),
    })
    .returning({ id: pastAttendances.id });

  revalidatePath("/analytics/past");
  revalidatePath("/analytics/past/list");

  return Response.json({ id: inserted.id }, { status: 201 });
}
