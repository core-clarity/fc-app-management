import { PageBackNav } from "@/components/PageBackNav";
import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { alias } from "drizzle-orm/pg-core";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { entries, members, performances, productions } from "@/db/schema";
import { type EntrySummaryData } from "@/components/EntrySummary";
import {
  companionTimingLabel,
  idVerificationLabel,
} from "@/lib/labels";
import { ProductionScheduleList } from "./production-schedule-list";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { id: string };
};

const companionMembers = alias(members, "companion_members");

export default async function ProductionDetailPage({ params }: PageProps) {
  noStore();

  const [production] = await db
    .select()
    .from(productions)
    .where(eq(productions.id, params.id))
    .limit(1);

  if (!production) {
    notFound();
  }

  const performanceRows = await db
    .select({
      id: performances.id,
      venue: performances.venue,
      performanceDate: performances.performanceDate,
      startTime: performances.startTime,
    })
    .from(performances)
    .where(eq(performances.productionId, production.id))
    .orderBy(
      asc(performances.performanceDate),
      asc(performances.startTime),
      asc(performances.venue)
    );

  const entryRows = await db
    .select({
      id: entries.id,
      performanceId: entries.performanceId,
      applicationGroupId: entries.applicationGroupId,
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
    .innerJoin(performances, eq(entries.performanceId, performances.id))
    .innerJoin(members, eq(entries.memberId, members.id))
    .leftJoin(
      companionMembers,
      eq(entries.companionMemberId, companionMembers.id)
    )
    .where(eq(performances.productionId, production.id))
    .orderBy(asc(members.label));

  const entriesByPerformance = new Map<string, EntrySummaryData[]>();
  for (const row of entryRows) {
    const summary: EntrySummaryData = {
      id: row.id,
      applicationGroupId: row.applicationGroupId,
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
    };
    const list = entriesByPerformance.get(row.performanceId) ?? [];
    list.push(summary);
    entriesByPerformance.set(row.performanceId, list);
  }

  const byVenue = new Map<
    string,
    {
      id: string;
      venue: string;
      performanceDate: string;
      startTime: string;
      entries: EntrySummaryData[];
    }[]
  >();

  for (const row of performanceRows) {
    const dateStr =
      typeof row.performanceDate === "string"
        ? row.performanceDate
        : String(row.performanceDate);
    const timeStr =
      typeof row.startTime === "string"
        ? row.startTime
        : String(row.startTime);
    const item = {
      id: row.id,
      venue: row.venue,
      performanceDate: dateStr,
      startTime: timeStr,
      entries: entriesByPerformance.get(row.id) ?? [],
    };
    const list = byVenue.get(row.venue) ?? [];
    list.push(item);
    byVenue.set(row.venue, list);
  }

  const venueGroups = Array.from(byVenue.entries()).sort(
    ([venueA, performancesA], [venueB, performancesB]) => {
      const firstA = performancesA[0];
      const firstB = performancesB[0];
      const keyA = `${firstA.performanceDate}T${firstA.startTime}|${venueA}`;
      const keyB = `${firstB.performanceDate}T${firstB.startTime}|${venueB}`;
      return keyA.localeCompare(keyB);
    }
  );
  const totalEntries = entryRows.length;

  return (
    <main className="min-h-screen bg-surface px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="border-b border-slate-200 pb-6">
          <PageBackNav links={[{ href: "/", label: "ホームへ" }]} />
          <div className="mt-3">
            <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {production.title}
            </h1>
            <p className="mt-2 text-base text-slate-600">
              {production.artist}
            </p>
          </div>
        </header>

        <section className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-ink">ルール</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm font-medium text-slate-500">同行者登録</dt>
              <dd className="mt-1 text-base text-ink">
                {companionTimingLabel(production.companionTiming)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">本人確認</dt>
              <dd className="mt-1 text-base text-ink">
                {idVerificationLabel(production.idVerification)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">一般同行</dt>
              <dd className="mt-1 text-base text-ink">
                {production.allowsGeneralCompanion ? "可（メール）" : "不可"}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-slate-500">
            公演 {performanceRows.length} 件 / エントリ合計 {totalEntries} 件
          </p>
          <div className="mt-5 border-t border-slate-100 pt-5">
            <h3 className="text-base font-semibold text-ink">一括登録</h3>
            <p className="mt-1 text-sm text-slate-600">
              複数のエントリや当落をまとめて登録します。
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/lottery/${production.id}`}
                className="inline-flex rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                当落を一括入力
              </Link>
              <Link
                href={`/entries/group/new?productionId=${production.id}`}
                className="inline-flex rounded-lg border border-brand/40 bg-white px-4 py-2.5 text-sm font-semibold text-brand-dark transition hover:bg-brand-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                第2希望以降ありの申込を登録
              </Link>
            </div>
          </div>
        </section>

        <ProductionScheduleList venueGroups={venueGroups} />
      </div>
    </main>
  );
}
