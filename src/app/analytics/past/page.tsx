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
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-8">
        <div className="mx-auto max-w-7xl">
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

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <BackHeader isViewer={isViewer} />

        <header className="mt-6 border-b border-slate-800 pb-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-400/80">
                Past Analytics
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                過去データの分析
              </h1>
            </div>
            {isViewer ? null : (
              <Link
                href="/analytics/past/list"
                className="rounded-lg border border-sky-500/50 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-500/20"
              >
                一覧・修正
              </Link>
            )}
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
    </div>
  );
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
