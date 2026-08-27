import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { auth, signOut } from "@/auth";
import { db } from "@/db";
import { entries, performances, productions } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();

  const productionList = await db
    .select({
      id: productions.id,
      title: productions.title,
      artist: productions.artist,
      companionTiming: productions.companionTiming,
      performanceCount: sql<number>`count(distinct ${performances.id})::int`,
      entryCount: sql<number>`count(${entries.id})::int`,
      pendingCount: sql<number>`count(${entries.id}) filter (where ${entries.lotteryResult} = 'pending')::int`,
      wonCount: sql<number>`count(${entries.id}) filter (where ${entries.lotteryResult} = 'won')::int`,
      lostCount: sql<number>`count(${entries.id}) filter (where ${entries.lotteryResult} = 'lost')::int`,
      paidCount: sql<number>`count(${entries.id}) filter (where ${entries.lotteryResult} = 'won' and ${entries.paymentStatus} = 'completed')::int`,
      unpaidCount: sql<number>`count(${entries.id}) filter (where ${entries.lotteryResult} = 'won' and ${entries.paymentStatus} != 'completed')::int`,
    })
    .from(productions)
    .leftJoin(performances, eq(performances.productionId, productions.id))
    .leftJoin(entries, eq(entries.performanceId, performances.id))
    .groupBy(
      productions.id,
      productions.title,
      productions.artist,
      productions.companionTiming,
      productions.createdAt
    )
    .orderBy(desc(productions.createdAt));

  return (
    <main className="min-h-screen bg-surface px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              おたくの現場
            </h1>
            <p className="mt-1 text-sm font-medium tracking-wide text-brand">
              チケット申込・当落・公演記録
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 sm:items-end">
            <p className="text-sm text-slate-600">
              ログイン中: {session?.user?.name ?? session?.user?.email}
            </p>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:border-brand/40 hover:bg-brand-soft hover:text-brand-dark"
              >
                ログアウト
              </button>
            </form>
          </div>
        </header>

        <section className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-ink">メニュー</h2>
          <p className="mt-2 text-base leading-relaxed text-slate-600">
            公演登録・公演日程・エントリ作成・当落一括入力・エントリ詳細（座席・金額）が利用できます。過去データの分析は下の「分析」から。
          </p>
          <div className="mt-6">
            <Link
              href="/productions/new"
              className="inline-flex rounded-lg bg-brand px-4 py-3 text-base font-semibold text-white transition hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              公演を登録する
            </Link>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-ink">登録済み公演</h2>
          <p className="mt-2 text-sm text-slate-500">
            当落・入金の件数は全名義の合計です。
          </p>
          {productionList.length === 0 ? (
            <p className="mt-3 text-base text-slate-600">
              まだ公演がありません。「公演を登録する」から追加してください。
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {productionList.map((p) => (
                <li key={p.id} className="py-4 first:pt-0 last:pb-0">
                  <Link
                    href={`/productions/${p.id}`}
                    className="block group"
                  >
                    <p className="text-base font-semibold text-ink group-hover:text-brand-dark">
                      {p.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {p.artist} ・ 公演 {p.performanceCount} 件 ・ 同行者
                      {p.companionTiming === "at_entry"
                        ? "申込時"
                        : "公演前OK"}
                    </p>
                  </Link>
                  {p.entryCount === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">エントリなし</p>
                  ) : (
                    <div className="mt-2 space-y-1 text-sm text-slate-700">
                      <p>
                        当落: 未設定 {p.pendingCount} / 当選 {p.wonCount} /
                        落選 {p.lostCount}
                      </p>
                      {p.wonCount > 0 ? (
                        <p>
                          入金: 未入金 {p.unpaidCount} / 入金済み {p.paidCount}
                        </p>
                      ) : null}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <Link
                      href={`/productions/${p.id}`}
                      className="font-medium text-brand-dark underline-offset-2 hover:underline"
                    >
                      公演日程
                    </Link>
                    <span className="text-slate-300" aria-hidden>
                      |
                    </span>
                    <Link
                      href={`/lottery/${p.id}`}
                      className="font-medium text-brand-dark underline-offset-2 hover:underline"
                    >
                      当落を入力
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-ink">分析</h2>
          <p className="mt-2 text-base leading-relaxed text-slate-600">
            エントリーの振り返りと、生涯観覧ログの集計です。
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <span
              className="inline-flex cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-400"
              title="STEP 7-4 で実装予定"
            >
              エントリーの分析（準備中）
            </span>
            <Link
              href="/analytics/past"
              className="inline-flex rounded-lg bg-brand px-4 py-3 text-base font-semibold text-white transition hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              過去データの分析
            </Link>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-ink">管理</h2>
          <p className="mt-2 text-base leading-relaxed text-slate-600">
            見た目の設定と、過去観覧ログの修正です。
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Link
              href="/settings/appearance"
              className="inline-flex rounded-lg border border-brand/40 bg-white px-4 py-3 text-base font-semibold text-brand-dark transition hover:bg-brand-soft"
            >
              色・アイコン管理
            </Link>
            <Link
              href="/analytics/past/list"
              className="inline-flex rounded-lg border border-brand/40 bg-white px-4 py-3 text-base font-semibold text-brand-dark transition hover:bg-brand-soft"
            >
              過去データの一覧・修正
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
