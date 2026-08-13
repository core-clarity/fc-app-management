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

export default async function LotteryPage({ params }: PageProps) {
  noStore();

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const data = await loadLotteryContext(params.productionId, session.user.id);
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
