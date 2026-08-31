import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { members, users } from "@/db/schema";
import { isMemberSymbolKey } from "@/lib/member-symbols";
import { isPastViewerEmail } from "@/lib/past-owner";
import { normalizeHexColor } from "@/lib/theme-colors";

export const runtime = "nodejs";

type RouteContext = { params: { id: string } };

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

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
    ownerUserId?: string | null;
    symbol?: string | null;
    themeColor?: string | null;
    canPassIdVerification?: boolean;
    isActive?: boolean;
  } = {};

  if (Object.prototype.hasOwnProperty.call(record, "ownerUserId")) {
    if (record.ownerUserId === null || record.ownerUserId === "") {
      patch.ownerUserId = null;
    } else if (
      typeof record.ownerUserId === "string" &&
      isUuid(record.ownerUserId)
    ) {
      const owner = await db.query.users.findFirst({
        where: eq(users.id, record.ownerUserId),
      });
      if (!owner || isPastViewerEmail(owner.email)) {
        return Response.json(
          { error: "担当ユーザーが不正です。" },
          { status: 400 }
        );
      }
      patch.ownerUserId = record.ownerUserId;
    } else {
      return Response.json({ error: "担当ユーザーが不正です。" }, { status: 400 });
    }
  }

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

  if (Object.prototype.hasOwnProperty.call(record, "isActive")) {
    if (typeof record.isActive !== "boolean") {
      return Response.json({ error: "isActive が不正です。" }, { status: 400 });
    }
    patch.isActive = record.isActive;
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
      ownerUserId: members.ownerUserId,
      symbol: members.symbol,
      themeColor: members.themeColor,
      canPassIdVerification: members.canPassIdVerification,
      isActive: members.isActive,
    });

  return Response.json({ member: updated });
}
