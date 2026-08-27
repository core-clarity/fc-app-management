import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { entries, members, performances } from "@/db/schema";
import { loadEntryDetail } from "@/lib/entry-detail";
import type { LotteryResult, PaymentStatus } from "@/lib/lottery";

export const runtime = "nodejs";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

type RouteContext = {
  params: { id: string };
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = context.params;
  if (!isUuid(id)) {
    return Response.json({ error: "エントリIDが不正です。" }, { status: 400 });
  }

  const data = await loadEntryDetail(id, session.user.id);
  if (!data) {
    return Response.json({ error: "エントリが見つかりません。" }, { status: 404 });
  }

  return Response.json(data);
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = context.params;
  if (!isUuid(id)) {
    return Response.json({ error: "エントリIDが不正です。" }, { status: 400 });
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
  const hasSeatInfo = Object.prototype.hasOwnProperty.call(body, "seatInfo");
  const hasPrice = Object.prototype.hasOwnProperty.call(body, "price");
  const hasLotteryResult = Object.prototype.hasOwnProperty.call(
    body,
    "lotteryResult"
  );
  const hasPaymentCompleted = Object.prototype.hasOwnProperty.call(
    body,
    "paymentCompleted"
  );

  if (
    !hasSeatInfo &&
    !hasPrice &&
    !hasLotteryResult &&
    !hasPaymentCompleted
  ) {
    return Response.json(
      { error: "更新するフィールドがありません。" },
      { status: 400 }
    );
  }

  if (hasSeatInfo && body.seatInfo !== null && typeof body.seatInfo !== "string") {
    return Response.json({ error: "seatInfo が不正です。" }, { status: 400 });
  }

  let parsedPrice: number | null | undefined = undefined;
  if (hasPrice) {
    if (body.price === null || body.price === "") {
      parsedPrice = null;
    } else if (typeof body.price === "number" && Number.isFinite(body.price)) {
      parsedPrice = Math.round(body.price);
    } else if (typeof body.price === "string" && body.price.trim()) {
      const n = Number(body.price.replace(/,/g, ""));
      if (!Number.isFinite(n)) {
        return Response.json({ error: "price が不正です。" }, { status: 400 });
      }
      parsedPrice = Math.round(n);
    } else {
      return Response.json({ error: "price が不正です。" }, { status: 400 });
    }
  }

  if (hasLotteryResult) {
    if (body.lotteryResult !== "won" && body.lotteryResult !== "lost") {
      return Response.json(
        { error: "制作開放は落選→当選のみ対応しています。" },
        { status: 400 }
      );
    }
  }

  if (hasPaymentCompleted && typeof body.paymentCompleted !== "boolean") {
    return Response.json(
      { error: "paymentCompleted が不正です。" },
      { status: 400 }
    );
  }

  const existing = await db
    .select({
      id: entries.id,
      memberId: entries.memberId,
      lotteryResult: entries.lotteryResult,
      paymentStatus: entries.paymentStatus,
      paidAt: entries.paidAt,
      seatInfo: entries.seatInfo,
      price: entries.price,
      performanceId: entries.performanceId,
      ownerUserId: members.ownerUserId,
      productionId: performances.productionId,
    })
    .from(entries)
    .innerJoin(members, eq(entries.memberId, members.id))
    .innerJoin(performances, eq(entries.performanceId, performances.id))
    .where(eq(entries.id, id))
    .limit(1);

  const row = existing[0];
  if (!row) {
    return Response.json({ error: "エントリが見つかりません。" }, { status: 404 });
  }

  if (row.ownerUserId !== session.user.id) {
    return Response.json(
      { error: "担当名義以外のエントリは更新できません。" },
      { status: 403 }
    );
  }

  let nextLotteryResult: LotteryResult = row.lotteryResult;
  let nextPaymentStatus: PaymentStatus = row.paymentStatus;
  let nextPaidAt: Date | null = row.paidAt;
  let nextSeatInfo = row.seatInfo;
  let nextPrice = row.price;

  if (hasSeatInfo) {
    const rawSeat =
      body.seatInfo === null
        ? ""
        : typeof body.seatInfo === "string"
          ? body.seatInfo.trim()
          : "";
    nextSeatInfo = rawSeat.length > 0 ? rawSeat : null;
  }

  if (parsedPrice !== undefined) {
    nextPrice = parsedPrice;
  }

  if (hasLotteryResult) {
    const target = body.lotteryResult as "won" | "lost";
    if (row.lotteryResult !== "lost" || target !== "won") {
      return Response.json(
        {
          error:
            "制作開放は、落選（lost）から当選（won）への変更のみ可能です。",
        },
        { status: 400 }
      );
    }
    nextLotteryResult = "won";
    const paymentCompleted =
      typeof body.paymentCompleted === "boolean"
        ? body.paymentCompleted
        : false;
    if (paymentCompleted) {
      nextPaymentStatus = "completed";
      nextPaidAt = new Date();
    } else {
      nextPaymentStatus = "pending";
      nextPaidAt = null;
    }
  } else if (hasPaymentCompleted) {
    // 当選済みの入金トグルのみ（任意・低優先だが詳細でも許可）
    if (row.lotteryResult !== "won") {
      return Response.json(
        { error: "入金の更新は当選エントリのみ可能です。" },
        { status: 400 }
      );
    }
    if (body.paymentCompleted) {
      nextPaymentStatus = "completed";
      nextPaidAt =
        row.paymentStatus === "completed" && row.paidAt
          ? row.paidAt
          : new Date();
    } else {
      nextPaymentStatus = "pending";
      nextPaidAt = null;
    }
  }

  try {
    await db
      .update(entries)
      .set({
        seatInfo: nextSeatInfo,
        price: nextPrice,
        lotteryResult: nextLotteryResult,
        paymentStatus: nextPaymentStatus,
        paidAt: nextPaidAt,
      })
      .where(eq(entries.id, id));

    revalidatePath(`/entries/${id}`);
    revalidatePath(`/productions/${row.productionId}`);
    revalidatePath(`/lottery/${row.productionId}`);
    revalidatePath(`/entries/new`);
    revalidatePath(`/`);

    const updated = await loadEntryDetail(id, session.user.id);
    return Response.json({ ok: true, entry: updated });
  } catch (error) {
    console.error("Entry PATCH error:", error);
    return Response.json(
      { error: "エントリの更新に失敗しました。" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = context.params;
  if (!isUuid(id)) {
    return Response.json({ error: "エントリIDが不正です。" }, { status: 400 });
  }

  const existing = await db.query.entries.findFirst({
    where: eq(entries.id, id),
  });

  if (!existing) {
    return Response.json({ error: "エントリが見つかりません。" }, { status: 404 });
  }

  const performance = await db.query.performances.findFirst({
    where: eq(performances.id, existing.performanceId),
  });

  await db.delete(entries).where(eq(entries.id, id));

  if (performance) {
    revalidatePath(`/productions/${performance.productionId}`);
    revalidatePath(`/entries/new`);
  }

  return Response.json({ ok: true, id });
}
