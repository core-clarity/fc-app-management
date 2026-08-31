import type { LotteryResult } from "@/lib/lottery";

export type EntryAnalyticsMember = {
  id: string;
  label: string;
  name: string;
  themeColor: string | null;
  isUnassigned: boolean;
};

export type EntryAnalyticsEntry = {
  memberId: string;
  lotteryResult: LotteryResult;
};

export type MemberEntryAnalytics = EntryAnalyticsMember & {
  total: number;
  won: number;
  lost: number;
  pending: number;
  resolved: number;
  winRate: number | null;
};

export type EntryAnalyticsPayload = {
  totalEntries: number;
  wonCount: number;
  lostCount: number;
  pendingCount: number;
  resolvedCount: number;
  winRate: number | null;
  members: MemberEntryAnalytics[];
};

export function buildEntryAnalytics(
  memberRows: EntryAnalyticsMember[],
  entryRows: EntryAnalyticsEntry[]
): EntryAnalyticsPayload {
  const statsByMember = new Map<string, MemberEntryAnalytics>(
    memberRows.map((member) => [
      member.id,
      {
        ...member,
        total: 0,
        won: 0,
        lost: 0,
        pending: 0,
        resolved: 0,
        winRate: null,
      },
    ])
  );

  for (const entry of entryRows) {
    const stats = statsByMember.get(entry.memberId);
    if (!stats) continue;

    stats.total += 1;
    if (entry.lotteryResult === "won") {
      stats.won += 1;
    } else if (entry.lotteryResult === "lost") {
      stats.lost += 1;
    } else {
      stats.pending += 1;
    }
  }

  let totalEntries = 0;
  let wonCount = 0;
  let lostCount = 0;
  let pendingCount = 0;

  const memberStats = Array.from(statsByMember.values())
    .map((stats) => {
      stats.resolved = stats.won + stats.lost;
      stats.winRate =
        stats.resolved > 0 ? (stats.won / stats.resolved) * 100 : null;

      totalEntries += stats.total;
      wonCount += stats.won;
      lostCount += stats.lost;
      pendingCount += stats.pending;

      return stats;
    })
    .sort(
      (a, b) =>
        b.total - a.total ||
        a.label.localeCompare(b.label, "ja") ||
        a.id.localeCompare(b.id)
    );

  const resolvedCount = wonCount + lostCount;

  return {
    totalEntries,
    wonCount,
    lostCount,
    pendingCount,
    resolvedCount,
    winRate:
      resolvedCount > 0 ? (wonCount / resolvedCount) * 100 : null,
    members: memberStats,
  };
}
