import { and, asc, eq, isNotNull, ne } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  artistThemes,
  members,
  oshiArtists,
  pastAttendances,
} from "@/db/schema";
import { MEMBER_SYMBOL_CATALOG } from "@/lib/member-symbols";
import { isPastViewerEmail } from "@/lib/past-owner";
import { autoThemeColor, normalizeHexColor } from "@/lib/theme-colors";

export const runtime = "nodejs";

async function requireEditor() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (isPastViewerEmail(session.user.email)) {
    return {
      error: Response.json({ error: "権限がありません。" }, { status: 403 }),
    };
  }
  return { session };
}

function sortMembersForAppearance<
  T extends { label: string; isActive: boolean },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aDummy = a.label === "不明" ? 1 : 0;
    const bDummy = b.label === "不明" ? 1 : 0;
    if (aDummy !== bDummy) return aDummy - bDummy;
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.label.localeCompare(b.label, "ja");
  });
}

export async function GET() {
  const gate = await requireEditor();
  if ("error" in gate && gate.error) return gate.error;

  const [memberRows, oshiRows, artistRows, distinctArtists] = await Promise.all(
    [
      db
        .select({
          id: members.id,
          label: members.label,
          name: members.name,
          symbol: members.symbol,
          themeColor: members.themeColor,
          isActive: members.isActive,
        })
        .from(members)
        .orderBy(asc(members.label)),
      db
        .select({
          id: oshiArtists.id,
          label: oshiArtists.label,
          themeColor: oshiArtists.themeColor,
          sortOrder: oshiArtists.sortOrder,
          isActive: oshiArtists.isActive,
        })
        .from(oshiArtists)
        .orderBy(asc(oshiArtists.sortOrder), asc(oshiArtists.label)),
      db
        .select({
          id: artistThemes.id,
          label: artistThemes.label,
          themeColor: artistThemes.themeColor,
          sortOrder: artistThemes.sortOrder,
          isActive: artistThemes.isActive,
        })
        .from(artistThemes)
        .orderBy(asc(artistThemes.sortOrder), asc(artistThemes.label)),
      db
        .selectDistinct({ artist: pastAttendances.artist })
        .from(pastAttendances)
        .where(
          and(
            isNotNull(pastAttendances.artist),
            ne(pastAttendances.artist, "")
          )
        ),
    ]
  );

  const knownLabels = new Set(artistRows.map((a) => a.label));
  const unregisteredArtists = distinctArtists
    .map((r) => r.artist?.trim() ?? "")
    .filter((label) => label.length > 0 && !knownLabels.has(label))
    .sort((a, b) => a.localeCompare(b, "ja"));

  return Response.json({
    symbolCatalog: MEMBER_SYMBOL_CATALOG,
    members: sortMembersForAppearance(memberRows),
    oshiList: oshiRows,
    artistThemes: artistRows,
    unregisteredArtists,
  });
}

/** 名義・推しの未設定色のみ自動割当（アーティストはチャート表示時に割当） */
export async function POST(request: Request) {
  const gate = await requireEditor();
  if ("error" in gate && gate.error) return gate.error;

  let body: { action?: string } = {};
  try {
    body = (await request.json()) as { action?: string };
  } catch {
    body = {};
  }

  if (body.action !== "auto-colors") {
    return Response.json({ error: "action が不正です。" }, { status: 400 });
  }

  const [memberRows, oshiRows] = await Promise.all([
    db.select().from(members),
    db.select().from(oshiArtists),
  ]);

  let membersUpdated = 0;
  for (const m of memberRows) {
    if (normalizeHexColor(m.themeColor)) continue;
    const color = autoThemeColor(`member:${m.id}`);
    await db
      .update(members)
      .set({ themeColor: color })
      .where(eq(members.id, m.id));
    membersUpdated += 1;
  }

  let oshiUpdated = 0;
  for (const o of oshiRows) {
    if (normalizeHexColor(o.themeColor)) continue;
    const color = autoThemeColor(`oshi:${o.id}`);
    await db
      .update(oshiArtists)
      .set({ themeColor: color })
      .where(eq(oshiArtists.id, o.id));
    oshiUpdated += 1;
  }

  return Response.json({
    ok: true,
    membersUpdated,
    oshiUpdated,
  });
}
