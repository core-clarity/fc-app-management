import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { members, users } from "@/db/schema";
import { isMemberSymbolKey } from "@/lib/member-symbols";
import { isPastViewerEmail } from "@/lib/past-owner";
import { normalizeHexColor } from "@/lib/theme-colors";

export const runtime = "nodejs";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

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

async function resolveOwner(ownerUserId: unknown) {
  if (ownerUserId === null || ownerUserId === "") return null;
  if (typeof ownerUserId !== "string" || !isUuid(ownerUserId)) return undefined;

  const owner = await db.query.users.findFirst({
    where: eq(users.id, ownerUserId),
  });
  if (!owner || isPastViewerEmail(owner.email)) return undefined;
  return owner.id;
}

export async function POST(request: Request) {
  const gate = await requireEditor();
  if ("error" in gate && gate.error) return gate.error;

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
  if (typeof record.label !== "string" || !record.label.trim()) {
    return Response.json({ error: "表示ラベルを入力してください。" }, { status: 400 });
  }
  if (typeof record.name !== "string" || !record.name.trim()) {
    return Response.json({ error: "氏名を入力してください。" }, { status: 400 });
  }

  const label = record.label.trim();
  const duplicate = await db.query.members.findFirst({
    where: eq(members.label, label),
  });
  if (duplicate) {
    return Response.json(
      { error: "同じ表示ラベルの名義がすでに存在します。" },
      { status: 409 }
    );
  }

  const ownerUserId = await resolveOwner(record.ownerUserId ?? null);
  if (ownerUserId === undefined) {
    return Response.json({ error: "担当ユーザーが不正です。" }, { status: 400 });
  }

  let symbol: string | null = null;
  if (record.symbol !== undefined && record.symbol !== null && record.symbol !== "") {
    if (typeof record.symbol !== "string" || !isMemberSymbolKey(record.symbol)) {
      return Response.json({ error: "アイコンが不正です。" }, { status: 400 });
    }
    symbol = record.symbol;
  }

  let themeColor: string | null = null;
  if (record.themeColor !== undefined && record.themeColor !== null && record.themeColor !== "") {
    const normalized = normalizeHexColor(
      typeof record.themeColor === "string" ? record.themeColor : null
    );
    if (!normalized) {
      return Response.json({ error: "色が不正です。" }, { status: 400 });
    }
    themeColor = normalized;
  }

  const canPassIdVerification =
    record.canPassIdVerification === undefined
      ? true
      : record.canPassIdVerification;
  if (typeof canPassIdVerification !== "boolean") {
    return Response.json(
      { error: "canPassIdVerification が不正です。" },
      { status: 400 }
    );
  }

  const isActive = record.isActive === undefined ? false : record.isActive;
  if (typeof isActive !== "boolean") {
    return Response.json({ error: "isActive が不正です。" }, { status: 400 });
  }

  const [member] = await db
    .insert(members)
    .values({
      label,
      name: record.name.trim(),
      ownerUserId,
      symbol,
      themeColor,
      canPassIdVerification,
      isActive,
    })
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

  return Response.json({ member }, { status: 201 });
}
