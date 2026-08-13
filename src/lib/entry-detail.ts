import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { entries, members, performances, productions } from "@/db/schema";
import type { LotteryResult, PaymentStatus } from "@/lib/lottery";

const companionMembers = alias(members, "companion_members");

export type EntryDetailDto = {
  id: string;
  seatInfo: string | null;
  lotteryResult: LotteryResult;
  resultNotifiedAt: string | null;
  paymentStatus: PaymentStatus;
  paidAt: string | null;
  companionType: "fc_member" | "general_email" | "none";
  companionEmail: string | null;
  appliedAt: string | null;
  canEdit: boolean;
  production: {
    id: string;
    title: string;
    artist: string;
  };
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
    ownerUserId: string | null;
  };
  companionMember: {
    id: string;
    label: string;
    name: string;
    symbol: string | null;
    themeColor: string | null;
  } | null;
};

function asDateOnlyString(value: Date | string | null): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return formatDateInJst(d);
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

function asString(value: Date | string): string {
  return typeof value === "string" ? value : String(value);
}

export async function loadEntryDetail(
  entryId: string,
  userId: string
): Promise<EntryDetailDto | null> {
  const rows = await db
    .select({
      id: entries.id,
      seatInfo: entries.seatInfo,
      lotteryResult: entries.lotteryResult,
      resultNotifiedAt: entries.resultNotifiedAt,
      paymentStatus: entries.paymentStatus,
      paidAt: entries.paidAt,
      companionType: entries.companionType,
      companionEmail: entries.companionEmail,
      appliedAt: entries.appliedAt,
      productionId: productions.id,
      productionTitle: productions.title,
      productionArtist: productions.artist,
      performanceId: performances.id,
      venue: performances.venue,
      performanceDate: performances.performanceDate,
      startTime: performances.startTime,
      memberId: members.id,
      memberLabel: members.label,
      memberName: members.name,
      memberSymbol: members.symbol,
      memberThemeColor: members.themeColor,
      memberOwnerUserId: members.ownerUserId,
      companionId: companionMembers.id,
      companionLabel: companionMembers.label,
      companionName: companionMembers.name,
      companionSymbol: companionMembers.symbol,
      companionThemeColor: companionMembers.themeColor,
    })
    .from(entries)
    .innerJoin(performances, eq(entries.performanceId, performances.id))
    .innerJoin(productions, eq(performances.productionId, productions.id))
    .innerJoin(members, eq(entries.memberId, members.id))
    .leftJoin(
      companionMembers,
      eq(entries.companionMemberId, companionMembers.id)
    )
    .where(eq(entries.id, entryId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const performanceDate = asString(row.performanceDate);
  const dateOnly =
    performanceDate.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ??
    asDateOnlyString(row.performanceDate) ??
    performanceDate;

  return {
    id: row.id,
    seatInfo: row.seatInfo,
    lotteryResult: row.lotteryResult,
    resultNotifiedAt: asDateOnlyString(row.resultNotifiedAt),
    paymentStatus: row.paymentStatus,
    paidAt: asDateOnlyString(row.paidAt),
    companionType: row.companionType,
    companionEmail: row.companionEmail,
    appliedAt: asDateOnlyString(row.appliedAt),
    canEdit: row.memberOwnerUserId === userId,
    production: {
      id: row.productionId,
      title: row.productionTitle,
      artist: row.productionArtist,
    },
    performance: {
      id: row.performanceId,
      venue: row.venue,
      performanceDate: dateOnly,
      startTime: asString(row.startTime),
    },
    member: {
      id: row.memberId,
      label: row.memberLabel,
      name: row.memberName,
      symbol: row.memberSymbol,
      themeColor: row.memberThemeColor,
      ownerUserId: row.memberOwnerUserId,
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
  };
}
