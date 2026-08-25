import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { artistThemes } from "@/db/schema";
import { isPastViewerEmail } from "@/lib/past-owner";
import { autoThemeColor, normalizeHexColor } from "@/lib/theme-colors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (isPastViewerEmail(session.user.email)) {
    return Response.json({ error: "権限がありません。" }, { status: 403 });
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
  const label =
    typeof record.label === "string" ? record.label.trim() : "";
  if (!label) {
    return Response.json({ error: "ラベルを入力してください。" }, { status: 400 });
  }

  let themeColor = normalizeHexColor(
    typeof record.themeColor === "string" ? record.themeColor : null
  );
  if (!themeColor) {
    themeColor = autoThemeColor(`artist:${label}`);
  }

  const existing = await db.query.artistThemes.findFirst({
    where: eq(artistThemes.label, label),
  });
  if (existing) {
    return Response.json(
      { error: "同じラベルのアーティスト色が既にあります。" },
      { status: 409 }
    );
  }

  const all = await db
    .select({ sortOrder: artistThemes.sortOrder })
    .from(artistThemes);
  const maxSort = all.reduce((m, r) => Math.max(m, r.sortOrder), 0);

  const [inserted] = await db
    .insert(artistThemes)
    .values({
      label,
      themeColor,
      sortOrder: maxSort + 10,
      isActive: true,
    })
    .returning({
      id: artistThemes.id,
      label: artistThemes.label,
      themeColor: artistThemes.themeColor,
      sortOrder: artistThemes.sortOrder,
      isActive: artistThemes.isActive,
    });

  return Response.json({ artistTheme: inserted }, { status: 201 });
}
