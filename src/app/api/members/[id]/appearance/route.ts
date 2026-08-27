import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { members } from "@/db/schema";
import { isMemberSymbolKey } from "@/lib/member-symbols";
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
    symbol?: string | null;
    themeColor?: string | null;
    canPassIdVerification?: boolean;
  } = {};

  if (Object.prototype.hasOwnProperty.call(record, "symbol")) {
    if (record.symbol === null || record.symbol === "") {
      patch.symbol = null;
    } else if (isMemberSymbolKey(record.symbol)) {
      patch.symbol = record.symbol;
    } else {
      return Response.json({ error: "アイコンが不正です。" }, { status: 400 });
    }
  }

  if (Object.prototype.hasOwnProperty.call(record, "themeColor")) {
    if (record.themeColor === null || record.themeColor === "") {
      patch.themeColor = null;
    } else {
      const hex = normalizeHexColor(
        typeof record.themeColor === "string" ? record.themeColor : null
      );
      if (!hex) {
        return Response.json({ error: "色が不正です。" }, { status: 400 });
      }
      patch.themeColor = hex;
    }
  }

  if (Object.prototype.hasOwnProperty.call(record, "canPassIdVerification")) {
    if (typeof record.canPassIdVerification !== "boolean") {
      return Response.json(
        { error: "canPassIdVerification が不正です。" },
        { status: 400 }
      );
    }
    patch.canPassIdVerification = record.canPassIdVerification;
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "更新内容がありません。" }, { status: 400 });
  }

  const existing = await db.query.members.findFirst({
    where: eq(members.id, id),
  });
  if (!existing) {
    return Response.json({ error: "名義が見つかりません。" }, { status: 404 });
  }

  const [updated] = await db
    .update(members)
    .set(patch)
    .where(eq(members.id, id))
    .returning({
      id: members.id,
      label: members.label,
      name: members.name,
      symbol: members.symbol,
      themeColor: members.themeColor,
      canPassIdVerification: members.canPassIdVerification,
      isActive: members.isActive,
    });

  return Response.json({ member: updated });
}
