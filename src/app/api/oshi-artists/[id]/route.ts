import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { oshiArtists } from "@/db/schema";
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
  if (!Object.prototype.hasOwnProperty.call(record, "themeColor")) {
    return Response.json({ error: "更新内容がありません。" }, { status: 400 });
  }

  const hex = normalizeHexColor(
    typeof record.themeColor === "string" ? record.themeColor : null
  );
  if (!hex) {
    return Response.json({ error: "色が不正です。" }, { status: 400 });
  }

  const existing = await db.query.oshiArtists.findFirst({
    where: eq(oshiArtists.id, id),
  });
  if (!existing) {
    return Response.json({ error: "推しが見つかりません。" }, { status: 404 });
  }

  const [updated] = await db
    .update(oshiArtists)
    .set({ themeColor: hex })
    .where(eq(oshiArtists.id, id))
    .returning({
      id: oshiArtists.id,
      label: oshiArtists.label,
      themeColor: oshiArtists.themeColor,
      sortOrder: oshiArtists.sortOrder,
      isActive: oshiArtists.isActive,
    });

  return Response.json({ oshi: updated });
}
