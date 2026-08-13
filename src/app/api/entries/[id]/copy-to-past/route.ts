import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  entries,
  oshiArtists,
  pastAttendances,
  performances,
  productions,
} from "@/db/schema";
import { isPastOwnerEmail, resolvePastOwnerUserId } from "@/lib/past-auth";

export const runtime = "nodejs";

const GENRES = new Set(["concert", "stage", "other"]);

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

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

function asDateOnly(value: Date | string): string {
  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    return value;
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "00";
  const day = parts.find((p) => p.type === "day")?.value ?? "00";
  return `${y}-${m}-${day}`;
}

type RouteContext = {
  params: { id: string };
};

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPastOwnerEmail(session.user.email)) {
    return Response.json(
      { error: "過去データへのコピー権限がありません。" },
      { status: 403 }
    );
  }

  const { id } = context.params;
  if (!isUuid(id)) {
    return Response.json({ error: "エントリIDが不正です。" }, { status: 400 });
  }

  const ownerId = await resolvePastOwnerUserId();
  if (!ownerId) {
    return Response.json(
      { error: "過去ログの持ち主が見つかりません。" },
      { status: 500 }
    );
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

  const genre = parseGenre(body.genre);
  if (!genre) {
    return Response.json({ error: "ジャンルを選択してください。" }, { status: 400 });
  }

  const oshiId = nullIfBlank(body.oshiId);
  if (oshiId && !isUuid(oshiId)) {
    return Response.json({ error: "推しの指定が不正です。" }, { status: 400 });
  }
  if (oshiId) {
    const oshi = await db.query.oshiArtists.findFirst({
      where: and(eq(oshiArtists.id, oshiId), eq(oshiArtists.isActive, true)),
    });
    if (!oshi) {
      return Response.json({ error: "推しが見つかりません。" }, { status: 400 });
    }
  }

  const price = parsePrice(body.price);
  if (
    price === undefined &&
    body.price !== undefined &&
    body.price !== null &&
    body.price !== ""
  ) {
    return Response.json({ error: "金額が不正です。" }, { status: 400 });
  }

  const topic = nullIfBlank(body.topic);

  const existing = await db
    .select({ id: pastAttendances.id })
    .from(pastAttendances)
    .where(eq(pastAttendances.sourceEntryId, id))
    .limit(1);

  if (existing[0]) {
    return Response.json(
      {
        error: "このエントリはすでに過去データへコピー済みです。",
        pastAttendanceId: existing[0].id,
      },
      { status: 409 }
    );
  }

  const rows = await db
    .select({
      entryId: entries.id,
      lotteryResult: entries.lotteryResult,
      seatInfo: entries.seatInfo,
      productionTitle: productions.title,
      productionArtist: productions.artist,
      venue: performances.venue,
      performanceDate: performances.performanceDate,
      startTime: performances.startTime,
    })
    .from(entries)
    .innerJoin(performances, eq(entries.performanceId, performances.id))
    .innerJoin(productions, eq(performances.productionId, productions.id))
    .where(eq(entries.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return Response.json({ error: "エントリが見つかりません。" }, { status: 404 });
  }
  if (row.lotteryResult !== "won") {
    return Response.json(
      { error: "当選エントリのみ過去データへコピーできます。" },
      { status: 400 }
    );
  }

  try {
    const [inserted] = await db
      .insert(pastAttendances)
      .values({
        ownerUserId: ownerId,
        artist: row.productionArtist,
        title: row.productionTitle,
        venue: row.venue,
        city: null,
        performanceDate: asDateOnly(row.performanceDate),
        startTime: normalizeTime(
          typeof row.startTime === "string"
            ? row.startTime
            : String(row.startTime)
        ),
        seatInfo: row.seatInfo,
        price: price === undefined ? null : price,
        genre,
        oshiId,
        topic,
        sourceType: "entry_copy",
        sourceImageIndex: null,
        sourceFile: null,
        sourceEntryId: row.entryId,
        notes: null,
        updatedAt: new Date(),
      })
      .returning({ id: pastAttendances.id });

    revalidatePath("/analytics/past");
    revalidatePath("/analytics/past/list");

    return Response.json({ id: inserted.id }, { status: 201 });
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : "";
    if (code === "23505") {
      const again = await db
        .select({ id: pastAttendances.id })
        .from(pastAttendances)
        .where(eq(pastAttendances.sourceEntryId, id))
        .limit(1);
      return Response.json(
        {
          error: "このエントリはすでに過去データへコピー済みです。",
          pastAttendanceId: again[0]?.id ?? null,
        },
        { status: 409 }
      );
    }
    throw err;
  }
}
