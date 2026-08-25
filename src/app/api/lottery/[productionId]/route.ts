import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { entries, members, performances, productions } from "@/db/schema";
import {
  isDateOnly,
  loadLotteryContext,
  toResultNotifiedAt,
  type LotteryResult,
} from "@/lib/lottery";

export const runtime = "nodejs";

type RouteContext = {
  params: { productionId: string };
};

type LotteryUpdate = {
  entryId: string;
  lotteryResult: LotteryResult;
  paymentCompleted: boolean;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { productionId } = context.params;
  if (!isUuid(productionId)) {
    return Response.json({ error: "productionId が不正です。" }, { status: 400 });
  }

  const data = await loadLotteryContext(productionId, session.user.id);
  if (!data) {
    return Response.json({ error: "公演が見つかりません。" }, { status: 404 });
  }

  return Response.json(data);
}

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { productionId } = context.params;
  if (!isUuid(productionId)) {
    return Response.json({ error: "productionId が不正です。" }, { status: 400 });
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

  if (!Array.isArray(body.updates) || body.updates.length === 0) {
    return Response.json(
      { error: "更新するエントリがありません。" },
      { status: 400 }
    );
  }

  const updates: LotteryUpdate[] = [];
  for (const item of body.updates) {
    if (!item || typeof item !== "object") {
      return Response.json({ error: "updates の形式が不正です。" }, { status: 400 });
    }
    const u = item as Record<string, unknown>;
    if (typeof u.entryId !== "string" || !isUuid(u.entryId)) {
      return Response.json({ error: "entryId が不正です。" }, { status: 400 });
    }
    if (
      u.lotteryResult !== "pending" &&
      u.lotteryResult !== "won" &&
      u.lotteryResult !== "lost"
    ) {
      return Response.json({ error: "当落結果が不正です。" }, { status: 400 });
    }
    if (typeof u.paymentCompleted !== "boolean") {
      return Response.json(
        { error: "入金状態（paymentCompleted）が不正です。" },
        { status: 400 }
      );
    }
    updates.push({
      entryId: u.entryId,
      lotteryResult: u.lotteryResult,
      paymentCompleted: u.paymentCompleted,
    });
  }

  const [production] = await db
    .select({ id: productions.id })
    .from(productions)
    .where(eq(productions.id, productionId))
    .limit(1);
  if (!production) {
    return Response.json({ error: "公演が見つかりません。" }, { status: 404 });
  }

  const ownedMemberIds = await db
    .select({ id: members.id })
    .from(members)
    .where(
      and(eq(members.ownerUserId, session.user.id), eq(members.isActive, true))
    );

  if (ownedMemberIds.length === 0) {
    return Response.json(
      { error: "担当名義がありません。" },
      { status: 403 }
    );
  }

  const ownedSet = new Set(ownedMemberIds.map((m) => m.id));
  const entryIds = updates.map((u) => u.entryId);

  const existingRows = await db
    .select({
      id: entries.id,
      memberId: entries.memberId,
      lotteryResult: entries.lotteryResult,
      paymentStatus: entries.paymentStatus,
      paidAt: entries.paidAt,
      productionId: performances.productionId,
    })
    .from(entries)
    .innerJoin(performances, eq(entries.performanceId, performances.id))
    .where(inArray(entries.id, entryIds));

  if (existingRows.length !== entryIds.length) {
    return Response.json(
      { error: "存在しないエントリが含まれています。" },
      { status: 400 }
    );
  }

  const existingById = new Map(existingRows.map((r) => [r.id, r]));

  for (const row of existingRows) {
    if (row.productionId !== productionId) {
      return Response.json(
        { error: "この公演に属さないエントリが含まれています。" },
        { status: 400 }
      );
    }
    if (!ownedSet.has(row.memberId)) {
      return Response.json(
        { error: "担当名義以外のエントリは更新できません。" },
        { status: 403 }
      );
    }
  }

  const hasResultChange = updates.some((u) => {
    const existing = existingById.get(u.entryId);
    return existing && existing.lotteryResult !== u.lotteryResult;
  });

  let notifiedAt: Date | null = null;
  let resultNotifiedAt: string | null = null;

  if (hasResultChange) {
    const resultNotifiedAtRaw = body.resultNotifiedAt;
    if (
      typeof resultNotifiedAtRaw !== "string" ||
      !resultNotifiedAtRaw.trim()
    ) {
      return Response.json(
        { error: "通知日を入力してください。" },
        { status: 400 }
      );
    }
    resultNotifiedAt = resultNotifiedAtRaw.trim();
    if (!isDateOnly(resultNotifiedAt)) {
      return Response.json(
        { error: "通知日の形式が不正です（YYYY-MM-DD）。" },
        { status: 400 }
      );
    }
    notifiedAt = toResultNotifiedAt(resultNotifiedAt);
  }

  const now = new Date();

  try {
    for (const update of updates) {
      const existing = existingById.get(update.entryId)!;
      const resultChanged = existing.lotteryResult !== update.lotteryResult;

      let paymentStatus: "not_required" | "pending" | "completed";
      let paidAt: Date | null;

      if (update.lotteryResult === "won") {
        if (update.paymentCompleted) {
          paymentStatus = "completed";
          // 新たに入金済みにするときだけ保存日時を入れる。既に完了なら維持
          paidAt =
            existing.paymentStatus === "completed" && existing.paidAt
              ? existing.paidAt
              : now;
        } else {
          paymentStatus = "pending";
          paidAt = null;
        }
      } else {
        paymentStatus = "not_required";
        paidAt = null;
      }

      await db
        .update(entries)
        .set({
          lotteryResult: update.lotteryResult,
          paymentStatus,
          paidAt,
          ...(resultChanged && notifiedAt
            ? { resultNotifiedAt: notifiedAt }
            : {}),
        })
        .where(eq(entries.id, update.entryId));
    }

    revalidatePath(`/lottery/${productionId}`);
    revalidatePath(`/productions/${productionId}`);
    revalidatePath(`/`);

    return Response.json({
      ok: true,
      updatedCount: updates.length,
      resultNotifiedAt,
    });
  } catch (error) {
    console.error("Lottery batch update error:", error);
    return Response.json(
      { error: "当落の保存に失敗しました。" },
      { status: 500 }
    );
  }
}
