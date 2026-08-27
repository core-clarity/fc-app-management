import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageBackNav } from "@/components/PageBackNav";
import { isPastViewerEmail } from "@/lib/past-owner";
import { AppearanceSettingsClient } from "./appearance-client";

export const dynamic = "force-dynamic";

export default async function AppearanceSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  if (isPastViewerEmail(session.user.email)) {
    redirect("/analytics/past");
  }

  return (
    <main className="min-h-screen bg-surface px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="border-b border-slate-200 pb-6">
          <PageBackNav links={[{ href: "/", label: "ホームへ" }]} />
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            見た目マスタ
          </h1>
          <p className="mt-2 text-base text-slate-600">
            名義のアイコン・色・顔認証可否、推しカラー、券面アーティスト色を編集します。アーティストは明示したいものだけ登録すればよく、チャートのトップ枠は未指定でも自動色になります。
          </p>
        </header>

        <AppearanceSettingsClient />
      </div>
    </main>
  );
}
