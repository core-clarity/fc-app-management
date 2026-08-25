import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { artistThemes } from "@/db/schema";
import { isPastViewerEmail } from "@/lib/past-owner";
import { normalizeHexColor } from "@/lib/theme-colors";

export const runtime = "nodejs";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

type RouteContext = { params: { id: string } };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (isPastViewerEmail(session.user.email)) {
    return Response.json({ error: "権限がありません。" }, { status: 403 });
  }

  const { id } = context.params;
  if (!isUuid(id)) {
    return Response.json({ error: "IDが不正です。" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSONが不正です。" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return Response.json({ error: "JSONが不正です。" }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const patch: {
    label?: string;
    themeColor?: string;
    isActive?: boolean;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (Object.prototype.hasOwnProperty.call(record, "label")) {
    const label =
      typeof record.label === "string" ? record.label.trim() : "";
    if (!label) {
      return Response.json({ error: "ラベルが不正です。" }, { status: 400 });
    }
    patch.label = label;
  }

  if (Object.prototype.hasOwnProperty.call(record, "themeColor")) {
    const hex = normalizeHexColor(
      typeof record.themeColor === "string" ? record.themeColor : null
    );
    if (!hex) {
      return Response.json({ error: "色が不正です。" }, { status: 400 });
    }
    patch.themeColor = hex;
  }

  if (Object.prototype.hasOwnProperty.call(record, "isActive")) {
    if (typeof record.isActive !== "boolean") {
      return Response.json({ error: "isActive が不正です。" }, { status: 400 });
    }
    patch.isActive = record.isActive;
  }

  if (Object.keys(patch).length <= 1) {
    return Response.json({ error: "更新内容がありません。" }, { status: 400 });
  }

  const existing = await db.query.artistThemes.findFirst({
    where: eq(artistThemes.id, id),
  });
  if (!existing) {
    return Response.json(
      { error: "アーティスト色が見つかりません。" },
      { status: 404 }
    );
  }

  if (patch.label && patch.label !== existing.label) {
    const clash = await db.query.artistThemes.findFirst({
      where: eq(artistThemes.label, patch.label),
    });
    if (clash) {
      return Response.json(
        { error: "同じラベルのアーティスト色が既にあります。" },
        { status: 409 }
      );
    }
  }

  const [updated] = await db
    .update(artistThemes)
    .set(patch)
    .where(eq(artistThemes.id, id))
    .returning({
      id: artistThemes.id,
      label: artistThemes.label,
      themeColor: artistThemes.themeColor,
      sortOrder: artistThemes.sortOrder,
      isActive: artistThemes.isActive,
    });

  return Response.json({ artistTheme: updated });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (isPastViewerEmail(session.user.email)) {
    return Response.json({ error: "権限がありません。" }, { status: 403 });
  }

  const { id } = context.params;
  if (!isUuid(id)) {
    return Response.json({ error: "IDが不正です。" }, { status: 400 });
  }

  const deleted = await db
    .delete(artistThemes)
    .where(eq(artistThemes.id, id))
    .returning({ id: artistThemes.id });

  if (deleted.length === 0) {
    return Response.json(
      { error: "アーティスト色が見つかりません。" },
      { status: 404 }
    );
  }

  return Response.json({ ok: true });
}
