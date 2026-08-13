import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PastListClient } from "./past-list-client";

export const dynamic = "force-dynamic";

export default async function PastListPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/analytics/past"
            className="text-base font-semibold text-sky-300 underline-offset-2 hover:underline"
          >
            ← 過去データの分析へ
          </Link>
          <Link
            href="/"
            className="text-sm text-slate-400 underline-offset-2 hover:text-sky-300 hover:underline"
          >
            ダッシュボード
          </Link>
        </div>

        <header className="mt-6 border-b border-slate-800 pb-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-400/80">
            Past Data Editor
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            過去データの一覧・修正
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            JSON 取り込み後の手修正・名寄せ・無効行削除・新規追加用です。編集は
            Katsura のみ。友人Bは閲覧できます。
          </p>
        </header>

        <div className="mt-6">
          <PastListClient />
        </div>
      </div>
    </main>
  );
}
