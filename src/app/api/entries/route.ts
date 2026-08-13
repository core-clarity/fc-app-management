import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { buildEntryAlerts } from "@/lib/entry-alerts";
import { entries, members, performances } from "@/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

export const runtime = "nodejs";

const companionMembers = alias(members, "companion_members");

type CompanionType = "fc_member" | "general_email" | "none";

type CreateEntryBody = {
  performanceId: string;
  memberId: string;
  companionType: CompanionType;
  companionMemberId?: string | null;
  companionEmail?: string | null;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

type NormalizeResult =
  | { ok: true; data: CreateEntryBody }
  | { ok: false; error: string };

function normalizeBody(body: unknown): NormalizeResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "リクエスト本文が不正です。" };
  }
  const b = body as Record<string, unknown>;

  if (!isNonEmptyString(b.performanceId) || !isUuid(b.performanceId)) {
    return { ok: false, error: "performanceId が不正です。" };
  }
  if (!isNonEmptyString(b.memberId) || !isUuid(b.memberId)) {
    return { ok: false, error: "申込名義を選択してください。" };
  }

  const companionType = b.companionType;
  if (
    companionType !== "fc_member" &&
    companionType !== "general_email" &&
    companionType !== "none"
  ) {
    return { ok: false, error: "同行者タイプが不正です。" };
  }

  let companionMemberId: string | null = null;
  let companionEmail: string | null = null;

  if (companionType === "fc_member") {
    if (!isNonEmptyString(b.companionMemberId) || !isUuid(b.companionMemberId)) {
      return { ok: false, error: "同行者の名義を選択してください。" };
    }
    if (b.companionMemberId === b.memberId) {
      return {
        ok: false,
        error: "申込名義と同じ名義を同行者には指定できません。",
      };
    }
    companionMemberId = b.companionMemberId;
  } else if (companionType === "general_email") {
    if (!isNonEmptyString(b.companionEmail)) {
      return { ok: false, error: "同行者のメールアドレスを入力してください。" };
    }
    const email = b.companionEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: "同行者のメールアドレスの形式が不正です。" };
    }
    companionEmail = email;
  }

  return {
    ok: true,
    data: {
      performanceId: b.performanceId,
      memberId: b.memberId,
      companionType,
      companionMemberId,
      companionEmail,
    },
  };
}

async function loadTourEntries(productionId: string) {
  const perfs = await db
    .select({ id: performances.id })
    .from(performances)
    .where(eq(performances.productionId, productionId));

  if (perfs.length === 0) return [];

  const performanceIds = perfs.map((p) => p.id);
  return db
    .select({
      id: entries.id,
      performanceId: entries.performanceId,
      memberId: entries.memberId,
      companionType: entries.companionType,
      companionMemberId: entries.companionMemberId,
    })
    .from(entries)
    .where(inArray(entries.performanceId, performanceIds));
}

async function loadPerformanceEntries(performanceId: string) {
  const rows = await db
    .select({
      id: entries.id,
      companionType: entries.companionType,
      companionEmail: entries.companionEmail,
      lotteryResult: entries.lotteryResult,
      paymentStatus: entries.paymentStatus,
      memberId: members.id,
      memberLabel: members.label,
      memberName: members.name,
      memberSymbol: members.symbol,
      memberThemeColor: members.themeColor,
      companionId: companionMembers.id,
      companionLabel: companionMembers.label,
      companionName: companionMembers.name,
      companionSymbol: companionMembers.symbol,
      companionThemeColor: companionMembers.themeColor,
    })
    .from(entries)
    .innerJoin(members, eq(entries.memberId, members.id))
    .leftJoin(
      companionMembers,
      eq(entries.companionMemberId, companionMembers.id)
    )
    .where(eq(entries.performanceId, performanceId))
    .orderBy(asc(members.label));

  return rows.map((row) => ({
    id: row.id,
    companionType: row.companionType,
    companionEmail: row.companionEmail,
    lotteryResult: row.lotteryResult,
    paymentStatus: row.paymentStatus,
    member: {
      id: row.memberId,
      label: row.memberLabel,
      name: row.memberName,
      symbol: row.memberSymbol,
      themeColor: row.memberThemeColor,
    },
    companionMember: row.companionId
      ? {
          id: row.companionId,
          label: row.companionLabel!,
          name: row.companionName!,
          symbol: row.companionSymbol,
          themeColor: row.companionThemeColor,
        }
      : null,
  }));
}

/** エントリ作成用コンテキスト（公演・名義・既存エントリ） */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const performanceId = searchParams.get("performanceId");
  if (!performanceId || !isUuid(performanceId)) {
    return Response.json(
      { error: "performanceId クエリが必要です。" },
      { status: 400 }
    );
  }

  const performance = await db.query.performances.findFirst({
    where: eq(performances.id, performanceId),
    with: { production: true },
  });

  if (!performance) {
    return Response.json({ error: "公演が見つかりません。" }, { status: 404 });
  }

  const activeMembers = await db
    .select({
      id: members.id,
      label: members.label,
      name: members.name,
      canPassIdVerification: members.canPassIdVerification,
      symbol: members.symbol,
      themeColor: members.themeColor,
    })
    .from(members)
    .where(eq(members.isActive, true))
    .orderBy(asc(members.label));

  const tourEntries = await loadTourEntries(performance.productionId);
  const performanceEntries = await loadPerformanceEntries(performanceId);

  return Response.json({
    performance: {
      id: performance.id,
      venue: performance.venue,
      performanceDate: performance.performanceDate,
      startTime: performance.startTime,
      productionId: performance.productionId,
    },
    production: {
      id: performance.production.id,
      title: performance.production.title,
      artist: performance.production.artist,
      companionTiming: performance.production.companionTiming,
      idVerification: performance.production.idVerification,
      allowsGeneralCompanion: performance.production.allowsGeneralCompanion,
    },
    members: activeMembers,
    tourEntries,
    performanceEntries,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "JSON の解析に失敗しました。" }, { status: 400 });
  }

  const normalized = normalizeBody(raw);
  if (!normalized.ok) {
    return Response.json({ error: normalized.error }, { status: 400 });
  }

  const body = normalized.data;

  const performance = await db.query.performances.findFirst({
    where: eq(performances.id, body.performanceId),
    with: { production: true },
  });

  if (!performance) {
    return Response.json({ error: "公演が見つかりません。" }, { status: 404 });
  }

  const production = performance.production;

  if (
    body.companionType === "general_email" &&
    !production.allowsGeneralCompanion
  ) {
    return Response.json(
      { error: "この公演では一般同行者（メール）は許可されていません。" },
      { status: 400 }
    );
  }

  const activeMemberList = await db
    .select()
    .from(members)
    .where(and(eq(members.isActive, true), eq(members.id, body.memberId)));

  const applicant = activeMemberList[0];
  if (!applicant) {
    return Response.json(
      { error: "申込名義が見つからないか、無効な名義です。" },
      { status: 400 }
    );
  }

  let companionMember = null;
  if (body.companionType === "fc_member" && body.companionMemberId) {
    const companionRows = await db
      .select()
      .from(members)
      .where(
        and(eq(members.isActive, true), eq(members.id, body.companionMemberId))
      );
    companionMember = companionRows[0] ?? null;
    if (!companionMember) {
      return Response.json(
        { error: "同行者名義が見つからないか、無効な名義です。" },
        { status: 400 }
      );
    }
  }

  const tourEntries = await loadTourEntries(production.id);

  const alerts = buildEntryAlerts({
    productionIdVerification: production.idVerification,
    companionTiming: production.companionTiming,
    member: applicant,
    companionMember,
    companionType: body.companionType,
    performanceId: body.performanceId,
    tourEntries,
  });

  try {
    const [entry] = await db
      .insert(entries)
      .values({
        performanceId: body.performanceId,
        memberId: body.memberId,
        companionType: body.companionType,
        companionMemberId:
          body.companionType === "fc_member" ? body.companionMemberId : null,
        companionEmail:
          body.companionType === "general_email" ? body.companionEmail : null,
      })
      .returning();

    revalidatePath(`/productions/${production.id}`);
    revalidatePath(`/entries/new`);

    return Response.json({ entry, alerts });
  } catch (error) {
    console.error("Create entry error:", error);
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("unique_entry") ||
      message.includes("Unique") ||
      message.includes("duplicate key")
    ) {
      return Response.json(
        {
          error:
            "この公演にはすでに同じ名義のエントリがあります。二重登録はできません。",
          alerts,
        },
        { status: 409 }
      );
    }
    return Response.json(
      { error: "エントリの保存に失敗しました。", alerts },
      { status: 500 }
    );
  }
}
