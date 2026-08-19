import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth, signOut } from "@/auth";
import { db } from "@/db";
import { oshiArtists, pastAttendances, users } from "@/db/schema";
import { buildPastAnalytics } from "@/lib/past-analytics";
import {
  isPastViewerEmail,
  PAST_OWNER_EMAIL,
} from "@/lib/past-owner";
import { PastCharts } from "./past-charts";

export const dynamic = "force-dynamic";

const DEFAULT_LATEST_PIN_COLOR = "#94A3B8";

type LatestShow = {
  sortKey: string;
  dateLabel: string;
  title: string;
  venue: string;
  pinColor: string;
};

export default async function PastAnalyticsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const isViewer = isPastViewerEmail(session.user.email);

  const owner = await db.query.users.findFirst({
    where: eq(users.email, PAST_OWNER_EMAIL),
  });

  if (!owner) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-slate-950 px-4 py-10 text-slate-100 sm:px-8">
        <div className="mx-auto min-w-0 max-w-7xl">
          <BackHeader isViewer={isViewer} />
          <p className="mt-8 text-slate-400">
            過去ログの持ち主（{PAST_OWNER_EMAIL}）が見つかりません。seed
            を実行してください。
          </p>
        </div>
      </main>
    );
  }

  const [rows, oshiList] = await Promise.all([
    db
      .select({
        artist: pastAttendances.artist,
        venue: pastAttendances.venue,
        performanceDate: pastAttendances.performanceDate,
        startTime: pastAttendances.startTime,
        price: pastAttendances.price,
        genre: pastAttendances.genre,
        oshiId: pastAttendances.oshiId,
        title: pastAttendances.title,
      })
      .from(pastAttendances)
      .where(eq(pastAttendances.ownerUserId, owner.id)),
    db.select().from(oshiArtists),
  ]);

  const data = buildPastAnalytics(
    rows,
    oshiList.map((o) => ({
      id: o.id,
      label: o.label,
      themeColor: o.themeColor,
    }))
  );
  const oshiColorById = new Map(
    oshiList.map((o) => [o.id, o.themeColor] as const)
  );
  const latestShows: LatestShow[] = rows
    .filter((row) => row.performanceDate)
    .map((row) => {
      const startTime = row.startTime?.slice(0, 5) ?? "";
      return {
        sortKey: `${row.performanceDate ?? ""} ${startTime}`,
        dateLabel: formatLatestDateTime(row.performanceDate, row.startTime),
        title: row.title,
        venue: row.venue?.trim() || "会場未設定",
        pinColor: row.oshiId
          ? (oshiColorById.get(row.oshiId) ?? DEFAULT_LATEST_PIN_COLOR)
          : DEFAULT_LATEST_PIN_COLOR,
      };
    })
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
    .slice(0, 3);

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-950 px-4 py-10 text-slate-100 sm:px-8">
      <div className="mx-auto min-w-0 max-w-7xl">
        <BackHeader isViewer={isViewer} />

        <header className="mt-6 border-b border-slate-800 pb-6">
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start lg:gap-8">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-400/80">
                Past Analytics
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                過去データの分析
              </h1>
            </div>
            <LatestShowsCard items={latestShows} />
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="参加公演"
              value={data.totalShows.toLocaleString("ja-JP")}
              unit="回"
            />
            <KpiCard
              label="アーティスト表記"
              value={data.artistVariantCount.toLocaleString("ja-JP")}
              unit="種"
            />
            <KpiCard
              label="制覇会場数"
              value={data.venueUniqueCount.toLocaleString("ja-JP")}
              unit="会場"
            />
            <KpiCard
              label="金額合計"
              value={isViewer ? "****" : Math.round(data.knownPriceSum / 1000).toLocaleString(
                "ja-JP"
              )}
              unit="k"
              tip={
                isViewer
                  ? undefined
                  : `¥${data.knownPriceSum.toLocaleString("ja-JP")}`
              }
            />
          </dl>
        </header>

        <div className="mt-6">
          {data.totalShows === 0 ? (
            <p className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-400">
              まだ過去データがありません。`npm run db:import-past`
              で初期投入してください。
            </p>
          ) : (
            <PastCharts
              data={
                isViewer
                  ? { ...data, cumulativeSpend: [], knownPriceSum: 0 }
                  : data
              }
              hideCumulativeSpend={isViewer}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function BackHeader({ isViewer }: { isViewer: boolean }) {
  if (isViewer) {
    return (
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-400">閲覧専用</p>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            ログアウト
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <Link
        href="/"
        className="text-base font-semibold text-sky-300 underline-offset-2 hover:underline"
      >
        ← ダッシュボードへ
      </Link>
      <Link
        href="/analytics/past/list"
        className="text-sm font-semibold text-sky-300 underline-offset-2 hover:underline"
      >
        一覧・修正 →
      </Link>
    </div>
  );
}

function LatestShowsCard({ items }: { items: LatestShow[] }) {
  if (items.length === 0) return null;

  return (
    <section className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
      <div className="space-y-2">
        <span className="inline-flex rounded border border-cyan-800/30 bg-cyan-950/50 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.2em] text-cyan-400">
          LATEST
        </span>
        <div className="min-w-0 space-y-1">
          {items.map((item) => (
            <div
              key={`${item.sortKey}-${item.title}-${item.venue}`}
              className="flex items-center gap-1.5 text-[11px] leading-4 text-slate-300 sm:gap-2"
            >
              <span className="shrink-0 whitespace-nowrap font-mono text-slate-500">
                {item.dateLabel}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium text-slate-100">
                {item.title}
              </span>
              <span className="flex min-w-0 max-w-[34%] items-center gap-1 text-slate-400 sm:max-w-[180px]">
                <LatestPinIcon color={item.pinColor} />
                <span className="truncate">{item.venue}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LatestPinIcon({ color }: { color: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-3 w-3 shrink-0"
      style={{ color }}
    >
      <path d="M12 3C8.686 3 6 5.686 6 9c0 4.389 4.938 10.028 5.148 10.266a1.13 1.13 0 0 0 1.704 0C13.062 19.028 18 13.389 18 9c0-3.314-2.686-6-6-6Zm0 8.25A2.25 2.25 0 1 1 12 6.75a2.25 2.25 0 0 1 0 4.5Z" />
    </svg>
  );
}

function formatLatestDateTime(
  performanceDate: string | null,
  startTime: string | null
): string {
  if (!performanceDate) return "--/--";
  const mmdd = performanceDate.slice(5).replace("-", "/");
  const hhmm = startTime?.slice(0, 5) ?? "";
  return hhmm ? `${mmdd} ${hhmm}` : mmdd;
}

function KpiCard({
  label,
  value,
  unit,
  tip,
}: {
  label: string;
  value: string;
  unit?: string;
  tip?: string;
}) {
  return (
    <div
      className={`relative rounded-xl border border-slate-700/80 bg-slate-900/70 px-4 py-5 text-center sm:px-5 ${
        tip ? "group cursor-help" : ""
      }`}
    >
      <dt className="text-xs font-medium tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-2 text-white">
        <span className="block text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">
          {value}
        </span>
        {unit ? (
          <span className="mt-1 block text-sm font-medium text-slate-400 sm:text-base">
            {unit}
          </span>
        ) : null}
      </dd>
      {tip ? (
        <div
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
        >
          {tip}
        </div>
      ) : null}
    </div>
  );
}
