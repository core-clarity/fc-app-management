import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { pastAttendances } from "@/db/schema";
import { isPastOwnerEmail, resolvePastOwnerUserId } from "@/lib/past-auth";

export const runtime = "nodejs";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

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

type RouteContext = { params: { id: string } };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPastOwnerEmail(session.user.email)) {
    return Response.json({ error: "過去データの編集権限がありません。" }, { status: 403 });
  }

  const { id } = context.params;
  if (!isUuid(id)) {
    return Response.json({ error: "IDが不正です。" }, { status: 400 });
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

  const existing = await db.query.pastAttendances.findFirst({
    where: and(
      eq(pastAttendances.id, id),
      eq(pastAttendances.ownerUserId, ownerId)
    ),
  });
  if (!existing) {
    return Response.json({ error: "データが見つかりません。" }, { status: 404 });
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    const title = nullIfBlank(body.title);
    if (!title) {
      return Response.json({ error: "title は必須です。" }, { status: 400 });
    }
    patch.title = title;
  }
  if (Object.prototype.hasOwnProperty.call(body, "artist")) {
    patch.artist = nullIfBlank(body.artist);
  }
  if (Object.prototype.hasOwnProperty.call(body, "venue")) {
    patch.venue = nullIfBlank(body.venue);
  }
  if (Object.prototype.hasOwnProperty.call(body, "city")) {
    patch.city = nullIfBlank(body.city);
  }
  if (Object.prototype.hasOwnProperty.call(body, "performanceDate")) {
    patch.performanceDate = nullIfBlank(body.performanceDate);
  }
  if (Object.prototype.hasOwnProperty.call(body, "startTime")) {
    patch.startTime = normalizeTime(nullIfBlank(body.startTime));
  }
  if (Object.prototype.hasOwnProperty.call(body, "seatInfo")) {
    patch.seatInfo = nullIfBlank(body.seatInfo);
  }
  if (Object.prototype.hasOwnProperty.call(body, "price")) {
    const price = parsePrice(body.price);
    if (
      price === undefined &&
      body.price !== null &&
      body.price !== ""
    ) {
      return Response.json({ error: "price が不正です。" }, { status: 400 });
    }
    patch.price = price === undefined ? null : price;
  }
  if (Object.prototype.hasOwnProperty.call(body, "genre")) {
    const genre = parseGenre(body.genre);
    if (!genre) {
      return Response.json({ error: "genre が不正です。" }, { status: 400 });
    }
    patch.genre = genre;
  }
  if (Object.prototype.hasOwnProperty.call(body, "oshiId")) {
    patch.oshiId = nullIfBlank(body.oshiId);
  }
  if (Object.prototype.hasOwnProperty.call(body, "topic")) {
    patch.topic = nullIfBlank(body.topic);
  }
  if (Object.prototype.hasOwnProperty.call(body, "notes")) {
    patch.notes = nullIfBlank(body.notes);
  }

  await db
    .update(pastAttendances)
    .set(patch)
    .where(eq(pastAttendances.id, id));

  revalidatePath("/analytics/past");
  revalidatePath("/analytics/past/list");

  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPastOwnerEmail(session.user.email)) {
    return Response.json({ error: "過去データの編集権限がありません。" }, { status: 403 });
  }

  const { id } = context.params;
  if (!isUuid(id)) {
    return Response.json({ error: "IDが不正です。" }, { status: 400 });
  }

  const ownerId = await resolvePastOwnerUserId();
  if (!ownerId) {
    return Response.json({ error: "過去ログの持ち主が見つかりません。" }, { status: 500 });
  }

  const deleted = await db
    .delete(pastAttendances)
    .where(
      and(
        eq(pastAttendances.id, id),
        eq(pastAttendances.ownerUserId, ownerId)
      )
    )
    .returning({ id: pastAttendances.id });

  if (deleted.length === 0) {
    return Response.json({ error: "データが見つかりません。" }, { status: 404 });
  }

  revalidatePath("/analytics/past");
  revalidatePath("/analytics/past/list");

  return Response.json({ ok: true });
}
