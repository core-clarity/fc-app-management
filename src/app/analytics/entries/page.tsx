import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { PageBackNav } from "@/components/PageBackNav";
import { db } from "@/db";
import { entries, members } from "@/db/schema";
import {
  buildEntryAnalytics,
  type EntryAnalyticsEntry,
  type EntryAnalyticsMember,
} from "@/lib/entry-analytics";
import { EntryAnalyticsCharts } from "./entry-analytics-charts";

export const dynamic = "force-dynamic";

function formatPercent(value: number | null): string {
  if (value == null) return "—";
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

function KpiCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-center shadow-sm sm:px-5">
      <p className="text-xs font-medium tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-slate-800">
        {value}
      </p>
      {note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
    </div>
  );
}

export default async function EntryAnalyticsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [memberRows, entryRows] = await Promise.all([
    db
      .select({
        id: members.id,
        label: members.label,
        name: members.name,
        themeColor: members.themeColor,
        ownerUserId: members.ownerUserId,
      })
      .from(members)
      .orderBy(asc(members.label)),
    db
      .select({
        memberId: entries.memberId,
        lotteryResult: entries.lotteryResult,
      })
      .from(entries)
      .innerJoin(members, eq(entries.memberId, members.id)),
  ]);

  const data = buildEntryAnalytics(
    memberRows.map(({ ownerUserId, ...member }) => ({
      ...member,
      isUnassigned: ownerUserId === null,
    })) satisfies EntryAnalyticsMember[],
    entryRows satisfies EntryAnalyticsEntry[]
  );

  return (
    <main className="min-h-screen bg-[#d5dee8] px-4 py-10 text-slate-800 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-slate-300/80 pb-6">
          <PageBackNav links={[{ href: "/", label: "ホームへ" }]} />
          <div className="mt-5">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
              Entry Analytics
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-800 sm:text-3xl">
              エントリーの分析
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              登録されている全名義のエントリを集計しています。未割当の名義も含みます。
              勝率は当落結果が確定したエントリのみで計算します。
            </p>
          </div>
        </header>

        <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="総エントリ数"
            value={data.totalEntries.toLocaleString("ja-JP")}
            note="公演単位の集計"
          />
          <KpiCard
            label="当選数"
            value={data.wonCount.toLocaleString("ja-JP")}
          />
          <KpiCard
            label="落選数"
            value={data.lostCount.toLocaleString("ja-JP")}
          />
          <KpiCard
            label="全体勝率"
            value={formatPercent(data.winRate)}
            note={`確定 ${data.resolvedCount.toLocaleString("ja-JP")} 件`}
          />
        </dl>

        <div className="mt-6">
          {data.totalEntries === 0 ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <p className="text-slate-600">
                まだエントリがありません。公演からエントリを追加してください。
              </p>
            </section>
          ) : (
            <EntryAnalyticsCharts data={data} />
          )}
        </div>
      </div>
    </main>
  );
}
