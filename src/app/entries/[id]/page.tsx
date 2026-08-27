import { notFound, redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { auth } from "@/auth";
import { PageBackNav } from "@/components/PageBackNav";
import { EntryDetailForm } from "./entry-detail-form";
import { loadEntryDetail } from "@/lib/entry-detail";
import { loadEntryPastCopyMeta } from "@/lib/entry-past-copy";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { id: string };
};

export default async function EntryDetailPage({ params }: PageProps) {
  noStore();

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const data = await loadEntryDetail(params.id, session.user.id);
  if (!data) {
    notFound();
  }

  const pastCopy = await loadEntryPastCopyMeta(
    data.id,
    data.lotteryResult,
    session.user.email
  );

  return (
    <main className="min-h-screen bg-surface px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="border-b border-slate-200 pb-6">
          <PageBackNav
            links={[
              { href: "/", label: "ホームへ" },
              {
                href: `/productions/${data.production.id}`,
                label: "公演日程へ",
              },
            ]}
          />
          <div className="mt-3">
            <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              エントリ詳細
            </h1>
            <p className="mt-2 text-base text-slate-600">
              座席の記録と、制作開放（落選→当選）の対応を行います。
            </p>
          </div>
        </header>

        <EntryDetailForm initial={data} pastCopy={pastCopy} />
      </div>
    </main>
  );
}
