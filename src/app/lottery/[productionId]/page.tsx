import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { auth } from "@/auth";
import { LotteryForm } from "./lottery-form";
import { loadLotteryContext } from "@/lib/lottery";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { productionId: string };
};

function dbErrorDetail(error: unknown): string {
  if (!error || typeof error !== "object") return "不明なエラー";
  const e = error as { message?: string; cause?: unknown };
  if (e.cause instanceof Error && e.cause.message) return e.cause.message;
  if (typeof e.cause === "string") return e.cause;
  if (typeof e.message === "string") return e.message;
  return "不明なエラー";
}

export default async function LotteryPage({ params }: PageProps) {
  noStore();

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  let data;
  try {
    data = await loadLotteryContext(params.productionId, session.user.id);
  } catch (error) {
    console.error("loadLotteryContext failed:", error);
    const detail = dbErrorDetail(error);
    return (
      <main className="min-h-screen bg-surface px-4 py-10 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <header className="border-b border-slate-200 pb-6">
            <Link
              href={`/productions/${params.productionId}`}
              className="inline-flex items-center text-base font-semibold text-brand-dark underline-offset-2 hover:underline"
            >
              ← 公演日程へ
            </Link>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
              当落一括入力
            </h1>
          </header>
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
            <p className="font-semibold">データの読み込みに失敗しました。</p>
            <p className="mt-2 text-sm text-red-800/90">
              一時的な接続エラーのことがあります。ページを再読み込みしてください。
            </p>
            <p className="mt-3 break-all font-mono text-xs text-red-700/80">
              {detail}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/lottery/${params.productionId}`}
                className="inline-flex rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
              >
                再読み込み
              </Link>
              <Link
                href={`/productions/${params.productionId}`}
                className="inline-flex rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700"
              >
                公演日程へ戻る
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!data) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-surface px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="border-b border-slate-200 pb-6">
          <Link
            href={`/productions/${data.production.id}`}
            className="inline-flex items-center text-base font-semibold text-brand-dark underline-offset-2 hover:underline"
          >
            ← 公演日程へ
          </Link>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                当落一括入力
              </h1>
              <p className="mt-2 text-base text-slate-600">
                担当名義のエントリについて、当選・落選と通知日を一括で記録します。
              </p>
            </div>
            <Link
              href="/"
              className="shrink-0 text-sm font-medium text-slate-600 underline-offset-2 hover:text-brand-dark hover:underline"
            >
              ダッシュボードへ
            </Link>
          </div>
        </header>

        <LotteryForm initial={data} />
      </div>
    </main>
  );
}
