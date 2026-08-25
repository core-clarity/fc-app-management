import { and, asc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { entries, members, performances, productions } from "@/db/schema";

const companionMembers = alias(members, "companion_members");

async function withDbRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 200 * (i + 1)));
      }
    }
  }
  throw lastError;
}

async function loadProductionById(productionId: string) {
  return withDbRetry(async () => {
    const [row] = await db
      .select({
        id: productions.id,
        title: productions.title,
        artist: productions.artist,
      })
      .from(productions)
      .where(eq(productions.id, productionId))
      .limit(1);
    return row ?? null;
  });
}

export type LotteryResult = "pending" | "won" | "lost";
export type PaymentStatus = "not_required" | "pending" | "completed";

export type LotteryEntryDto = {
  id: string;
  lotteryResult: LotteryResult;
  resultNotifiedAt: string | null;
  paymentStatus: PaymentStatus;
  paidAt: string | null;
  companionType: "fc_member" | "general_email" | "none";
  companionEmail: string | null;
  performance: {
    id: string;
    venue: string;
    performanceDate: string;
    startTime: string;
  };
  member: {
    id: string;
    label: string;
    name: string;
    symbol: string | null;
    themeColor: string | null;
  };
  companionMember: {
    id: string;
    label: string;
    name: string;
    symbol: string | null;
    themeColor: string | null;
  } | null;
};

export type LotteryContext = {
  production: {
    id: string;
    title: string;
    artist: string;
  };
  entries: LotteryEntryDto[];
};

export async function loadLotteryContext(
  productionId: string,
  userId: string
): Promise<LotteryContext | null> {
  const production = await loadProductionById(productionId);
  if (!production) return null;

  const ownedMembers = await db
    .select({
      id: members.id,
      label: members.label,
      name: members.name,
      symbol: members.symbol,
      themeColor: members.themeColor,
    })
    .from(members)
    .where(and(eq(members.ownerUserId, userId), eq(members.isActive, true)))
    .orderBy(asc(members.label));

  if (ownedMembers.length === 0) {
    return {
      production: {
        id: production.id,
        title: production.title,
        artist: production.artist,
      },
      entries: [],
    };
  }

  const ownedIds = ownedMembers.map((m) => m.id);

  const rows = await db
    .select({
      id: entries.id,
      lotteryResult: entries.lotteryResult,
      resultNotifiedAt: entries.resultNotifiedAt,
      paymentStatus: entries.paymentStatus,
      paidAt: entries.paidAt,
      companionType: entries.companionType,
      companionEmail: entries.companionEmail,
      performanceId: performances.id,
      venue: performances.venue,
      performanceDate: performances.performanceDate,
      startTime: performances.startTime,
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
    .innerJoin(performances, eq(entries.performanceId, performances.id))
    .innerJoin(members, eq(entries.memberId, members.id))
    .leftJoin(
      companionMembers,
      eq(entries.companionMemberId, companionMembers.id)
    )
    .where(
      and(
        eq(performances.productionId, productionId),
        inArray(entries.memberId, ownedIds)
      )
    )
    .orderBy(
      asc(performances.performanceDate),
      asc(performances.startTime),
      asc(performances.venue),
      asc(members.label)
    );

  const entryDtos: LotteryEntryDto[] = rows.map((row) => ({
    id: row.id,
    lotteryResult: row.lotteryResult,
    resultNotifiedAt: row.resultNotifiedAt
      ? formatDateOnly(row.resultNotifiedAt)
      : null,
    paymentStatus: row.paymentStatus,
    paidAt: row.paidAt ? formatDateOnly(row.paidAt) : null,
    companionType: row.companionType,
    companionEmail: row.companionEmail,
    performance: {
      id: row.performanceId,
      venue: row.venue,
      performanceDate:
        typeof row.performanceDate === "string"
          ? row.performanceDate
          : String(row.performanceDate),
      startTime:
        typeof row.startTime === "string"
          ? row.startTime
          : String(row.startTime),
    },
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

  return {
    production: {
      id: production.id,
      title: production.title,
      artist: production.artist,
    },
    entries: entryDtos,
  };
}

/** 日付のみを JST 正午の timestamp に変換（表示時の日ずれ回避） */
export function toResultNotifiedAt(dateOnly: string): Date {
  return new Date(`${dateOnly}T12:00:00+09:00`);
}

export function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function formatDateOnly(value: Date | string): string {
  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return formatDateInJst(d);
    }
    return value;
  }
  return formatDateInJst(value);
}

function formatDateInJst(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "00";
  const day = parts.find((p) => p.type === "day")?.value ?? "00";
  return `${y}-${m}-${day}`;
}
