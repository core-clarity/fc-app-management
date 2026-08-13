import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { oshiArtists, pastAttendances } from "@/db/schema";
import { isPastOwnerEmail } from "@/lib/past-auth";
import type { LotteryResult } from "@/lib/lottery";

export type OshiOption = {
  id: string;
  label: string;
  themeColor: string | null;
};

export type EntryPastCopyMeta = {
  isPastOwner: boolean;
  canCopyToPast: boolean;
  copiedPastAttendanceId: string | null;
  oshiList: OshiOption[];
};

export async function loadEntryPastCopyMeta(
  entryId: string,
  lotteryResult: LotteryResult,
  userEmail: string | null | undefined
): Promise<EntryPastCopyMeta> {
  if (!isPastOwnerEmail(userEmail)) {
    return {
      isPastOwner: false,
      canCopyToPast: false,
      copiedPastAttendanceId: null,
      oshiList: [],
    };
  }

  const [copied] = await db
    .select({ id: pastAttendances.id })
    .from(pastAttendances)
    .where(eq(pastAttendances.sourceEntryId, entryId))
    .limit(1);

  const oshiList = await db
    .select({
      id: oshiArtists.id,
      label: oshiArtists.label,
      themeColor: oshiArtists.themeColor,
    })
    .from(oshiArtists)
    .where(eq(oshiArtists.isActive, true))
    .orderBy(asc(oshiArtists.sortOrder));

  return {
    isPastOwner: true,
    canCopyToPast: lotteryResult === "won" && !copied,
    copiedPastAttendanceId: copied?.id ?? null,
    oshiList,
  };
}
