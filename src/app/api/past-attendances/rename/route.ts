import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { pastAttendances } from "@/db/schema";
import { isPastOwnerEmail, resolvePastOwnerUserId } from "@/lib/past-auth";

export const runtime = "nodejs";

/**
 * 表記ゆれの一括置換
 * body: { field: "artist" | "venue", from: string, to: string }
 * from/to が同じでも trim 差し替えに使える。to が空文字なら null 化。
 */
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
  const field = body.field;
  if (field !== "artist" && field !== "venue") {
    return Response.json({ error: "field は artist または venue です。" }, { status: 400 });
  }
  if (typeof body.from !== "string" || !body.from.trim()) {
    return Response.json({ error: "from が不正です。" }, { status: 400 });
  }
  if (typeof body.to !== "string") {
    return Response.json({ error: "to が不正です。" }, { status: 400 });
  }

  const from = body.from.trim();
  const to = body.to.trim();
  const toValue = to.length ? to : null;

  const column =
    field === "artist" ? pastAttendances.artist : pastAttendances.venue;

  const updated = await db
    .update(pastAttendances)
    .set({
      [field]: toValue,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(pastAttendances.ownerUserId, ownerId),
        sql`btrim(${column}) = ${from}`
      )
    )
    .returning({ id: pastAttendances.id });

  revalidatePath("/analytics/past");
  revalidatePath("/analytics/past/list");

  return Response.json({ updated: updated.length, field, from, to: toValue });
}
