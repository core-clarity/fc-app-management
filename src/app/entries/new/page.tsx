"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { PageBackNav } from "@/components/PageBackNav";
import { MemberSymbol } from "@/components/MemberSymbol";
import {
  EntrySummaryLine,
  type EntrySummaryData,
} from "@/components/EntrySummary";
import {
  buildEntryAlerts,
  type ExistingEntryLike,
} from "@/lib/entry-alerts";
import {
  companionTimingLabel,
  dateToneClassName,
  formatDateWithDow,
  formatTimeDisplay,
  idVerificationLabel,
} from "@/lib/labels";

type CompanionType = "fc_member" | "general_email" | "none";

type MemberOption = {
  id: string;
  label: string;
  name: string;
  canPassIdVerification: boolean;
  symbol: string | null;
  themeColor: string | null;
};

type ContextData = {
  performance: {
    id: string;
    venue: string;
    performanceDate: string;
    startTime: string;
    productionId: string;
  };
  production: {
    id: string;
    title: string;
    artist: string;
    companionTiming: "at_entry" | "before_show";
    idVerification: "none" | "face_auth" | "other";
    allowsGeneralCompanion: boolean;
  };
  members: MemberOption[];
  tourEntries: ExistingEntryLike[];
  performanceEntries: EntrySummaryData[];
};

function inputClassName() {
  return "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/25";
}

function labelClassName() {
  return "mb-1.5 block text-sm font-medium text-ink";
}

function NewEntryForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const performanceId = searchParams.get("performanceId");

  const [ctx, setCtx] = useState<ContextData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [mode, setMode] = useState<"list" | "add">("list");

  const [memberId, setMemberId] = useState("");
  const [companionMode, setCompanionMode] = useState<
    "fc_member" | "general_email" | "skip"
  >("fc_member");
  const [companionMemberId, setCompanionMemberId] = useState("");
  const [companionEmail, setCompanionEmail] = useState("");

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadContext = useCallback(async (pid: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/entries?performanceId=${encodeURIComponent(pid)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setLoadError(
          typeof data.error === "string"
            ? data.error
            : "公演情報の取得に失敗しました。"
        );
        setCtx(null);
        return;
      }
      const next = data as ContextData;
      setCtx(next);
      if (data.production?.companionTiming === "before_show") {
        setCompanionMode("skip");
      } else {
        setCompanionMode("fc_member");
      }
      // 既存がなければすぐ追加フォーム。あれば一覧から開始
      setMode(
        Array.isArray(next.performanceEntries) &&
          next.performanceEntries.length > 0
          ? "list"
          : "add"
      );
    } catch {
      setLoadError("通信エラーが発生しました。");
      setCtx(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!performanceId) {
      setLoading(false);
      setLoadError("performanceId が指定されていません。");
      return;
    }
    void loadContext(performanceId);
  }, [performanceId, loadContext]);

  const companionType: CompanionType = useMemo(() => {
    if (!ctx) return "none";
    if (companionMode === "skip") return "none";
    if (companionMode === "general_email") return "general_email";
    return "fc_member";
  }, [ctx, companionMode]);

  const selectedMember = useMemo(
    () => ctx?.members.find((m) => m.id === memberId) ?? null,
    [ctx, memberId]
  );

  const selectedCompanion = useMemo(
    () =>
      companionType === "fc_member"
        ? (ctx?.members.find((m) => m.id === companionMemberId) ?? null)
        : null,
    [ctx, companionType, companionMemberId]
  );

  const liveAlerts = useMemo(() => {
    if (!ctx || !selectedMember) return [];
    return buildEntryAlerts({
      productionIdVerification: ctx.production.idVerification,
      companionTiming: ctx.production.companionTiming,
      member: selectedMember,
      companionMember: selectedCompanion,
      companionType,
      performanceId: ctx.performance.id,
      tourEntries: ctx.tourEntries,
    });
  }, [ctx, selectedMember, selectedCompanion, companionType]);

  const takenMemberIds = useMemo(() => {
    if (!ctx) return new Set<string>();
    return new Set(ctx.performanceEntries.map((e) => e.member.id));
  }, [ctx]);

  const applicantOptions = useMemo(() => {
    if (!ctx) return [];
    return ctx.members.filter((m) => !takenMemberIds.has(m.id));
  }, [ctx, takenMemberIds]);

  const companionMemberOptions = useMemo(() => {
    if (!ctx) return [];
    return ctx.members.filter((m) => m.id !== memberId);
  }, [ctx, memberId]);

  function resetAddForm() {
    setMemberId("");
    setCompanionMemberId("");
    setCompanionEmail("");
    setError(null);
    if (ctx?.production.companionTiming === "before_show") {
      setCompanionMode("skip");
    } else {
      setCompanionMode("fc_member");
    }
  }

  async function onSave() {
    if (saving || !ctx) return;

    setSaving(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        performanceId: ctx.performance.id,
        memberId,
        companionType,
      };
      if (companionType === "fc_member") {
        body.companionMemberId = companionMemberId;
      } else if (companionType === "general_email") {
        body.companionEmail = companionEmail;
      }

      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : "保存に失敗しました。"
        );
        return;
      }

      // 削除→追加運用: 結果確認は公演日程一覧で行う
      router.push(`/productions/${ctx.production.id}`);
      router.refresh();
    } catch {
      setError("通信エラーが発生しました。もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(entryId: string) {
    if (deletingId || !ctx) return;
    if (!window.confirm("このエントリを削除しますか？ 修正する場合は削除後に追加してください。")) {
      return;
    }

    setDeletingId(entryId);
    setError(null);

    try {
      const res = await fetch(`/api/entries/${entryId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : "削除に失敗しました。"
        );
        return;
      }
      await loadContext(ctx.performance.id);
      router.refresh();
    } catch {
      setError("通信エラーが発生しました。もう一度お試しください。");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <>
        <PageChrome />
        <p className="mt-8 text-base text-slate-600" role="status">
          読み込み中…
        </p>
      </>
    );
  }

  if (loadError || !ctx) {
    return (
      <>
        <PageChrome />
        <div className="mt-8 space-y-4">
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {loadError ?? "データがありません。"}
          </p>
          <PageBackNav links={[{ href: "/", label: "ホームへ" }]} />
        </div>
      </>
    );
  }

  const { production, performance } = ctx;
  const canGeneral = production.allowsGeneralCompanion;
  const hasEntries = ctx.performanceEntries.length > 0;

  return (
    <>
      <PageChrome productionId={production.id} />

      <section className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-ink">対象公演</h2>
        <p className="mt-3 text-base font-medium text-ink">{production.title}</p>
        <p className="mt-1 text-sm text-slate-600">{production.artist}</p>
        <p className="mt-3 text-base text-ink">
          {performance.venue}
          <br />
          <span
            className={dateToneClassName(
              typeof performance.performanceDate === "string"
                ? performance.performanceDate
                : String(performance.performanceDate)
            )}
          >
            {formatDateWithDow(
              typeof performance.performanceDate === "string"
                ? performance.performanceDate
                : String(performance.performanceDate)
            )}
          </span>{" "}
          {formatTimeDisplay(
            typeof performance.startTime === "string"
              ? performance.startTime
              : String(performance.startTime)
          )}
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">同行者登録</dt>
            <dd className="mt-0.5 text-ink">
              {companionTimingLabel(production.companionTiming)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">本人確認</dt>
            <dd className="mt-0.5 text-ink">
              {idVerificationLabel(production.idVerification)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">一般同行</dt>
            <dd className="mt-0.5 text-ink">
              {production.allowsGeneralCompanion ? "可" : "不可"}
            </dd>
          </div>
        </dl>
      </section>

      {/* 登録済み一覧 */}
      <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-ink">
            この公演のエントリ（{ctx.performanceEntries.length} 件）
          </h2>
          {mode === "list" ? (
            <button
              type="button"
              onClick={() => {
                resetAddForm();
                setMode("add");
              }}
              disabled={applicantOptions.length === 0}
              className="inline-flex rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              追加する
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-slate-600">
          修正はインライン編集ではなく、削除してから追加し直す運用です。
        </p>

        {hasEntries ? (
          <ul className="mt-5 divide-y divide-slate-100">
            {ctx.performanceEntries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <EntrySummaryLine entry={entry} />
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/entries/${entry.id}`}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-brand-dark transition hover:bg-brand-soft"
                  >
                    座席・金額
                  </Link>
                  <button
                    type="button"
                    onClick={() => void onDelete(entry.id)}
                    disabled={deletingId === entry.id}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
                  >
                    {deletingId === entry.id ? "削除中…" : "削除"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-slate-500">まだエントリがありません。</p>
        )}

        {applicantOptions.length === 0 && hasEntries ? (
          <p className="mt-4 text-sm text-amber-800">
            アクティブ名義はすべてこの公演に登録済みです。追加するには既存を削除してください。
          </p>
        ) : null}
      </section>

      {/* 追加フォーム */}
      {mode === "add" ? (
        <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-ink">エントリを追加</h2>
            {hasEntries ? (
              <button
                type="button"
                onClick={() => {
                  resetAddForm();
                  setMode("list");
                }}
                className="text-sm font-medium text-brand-dark underline-offset-2 hover:underline"
              >
                一覧に戻る
              </button>
            ) : null}
          </div>

          <div className="mt-6 space-y-6">
            <div>
              <label htmlFor="memberId" className={labelClassName()}>
                申込名義
              </label>
              <select
                id="memberId"
                value={memberId}
                onChange={(e) => {
                  setMemberId(e.target.value);
                  if (e.target.value === companionMemberId) {
                    setCompanionMemberId("");
                  }
                }}
                className={inputClassName()}
              >
                <option value="">選択してください</option>
                {applicantOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}（{m.name}）
                    {!m.canPassIdVerification ? " ・顔認証不可" : ""}
                  </option>
                ))}
              </select>
              {selectedMember ? (
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                  <MemberSymbol
                    symbol={selectedMember.symbol}
                    themeColor={selectedMember.themeColor}
                    size={22}
                  />
                  <span>
                    {selectedMember.name}
                    {selectedMember.label}
                  </span>
                </div>
              ) : null}
            </div>

            <fieldset>
              <legend className={labelClassName()}>
                同行者
                <span className="ml-1 text-slate-500">（ソロ可）</span>
              </legend>

              <div className="mt-2 space-y-2">
                <label className="flex items-center gap-2 text-base text-ink">
                  <input
                    type="radio"
                    name="companionMode"
                    checked={companionMode === "skip"}
                    onChange={() => setCompanionMode("skip")}
                    className="h-4 w-4 accent-[var(--brand)]"
                  />
                  同行者なし（ソロ）
                </label>
                <label className="flex items-center gap-2 text-base text-ink">
                  <input
                    type="radio"
                    name="companionMode"
                    checked={companionMode === "fc_member"}
                    onChange={() => setCompanionMode("fc_member")}
                    className="h-4 w-4 accent-[var(--brand)]"
                  />
                  FC名義から選ぶ
                </label>
                {canGeneral ? (
                  <label className="flex items-center gap-2 text-base text-ink">
                    <input
                      type="radio"
                      name="companionMode"
                      checked={companionMode === "general_email"}
                      onChange={() => setCompanionMode("general_email")}
                      className="h-4 w-4 accent-[var(--brand)]"
                    />
                    一般同行（メールアドレス）
                  </label>
                ) : null}
              </div>

              {companionMode === "fc_member" ? (
                <div className="mt-4">
                  <label htmlFor="companionMemberId" className={labelClassName()}>
                    同行者名義
                  </label>
                  <select
                    id="companionMemberId"
                    value={companionMemberId}
                    onChange={(e) => setCompanionMemberId(e.target.value)}
                    className={inputClassName()}
                  >
                    <option value="">選択してください</option>
                    {companionMemberOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}（{m.name}）
                        {!m.canPassIdVerification ? " ・顔認証不可" : ""}
                      </option>
                    ))}
                  </select>
                  {selectedCompanion ? (
                    <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                      <MemberSymbol
                        symbol={selectedCompanion.symbol}
                        themeColor={selectedCompanion.themeColor}
                        size={22}
                      />
                      <span>
                        {selectedCompanion.name}
                        {selectedCompanion.label}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {companionMode === "general_email" && canGeneral ? (
                <div className="mt-4">
                  <label htmlFor="companionEmail" className={labelClassName()}>
                    同行者メールアドレス
                  </label>
                  <input
                    id="companionEmail"
                    type="email"
                    value={companionEmail}
                    onChange={(e) => setCompanionEmail(e.target.value)}
                    className={inputClassName()}
                    placeholder="example@example.com"
                  />
                </div>
              ) : null}
            </fieldset>
          </div>

          {liveAlerts.length > 0 ? (
            <ul className="mt-6 space-y-2" aria-live="polite">
              {liveAlerts.map((a) => (
                <li
                  key={a.code}
                  className={
                    a.level === "warning"
                      ? "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                      : "rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900"
                  }
                >
                  {a.level === "warning" ? "注意: " : "情報: "}
                  {a.message}
                </li>
              ))}
            </ul>
          ) : null}

          <button
            type="button"
            onClick={onSave}
            disabled={
              saving ||
              !memberId ||
              applicantOptions.length === 0 ||
              (companionType === "fc_member" && !companionMemberId) ||
              (companionType === "general_email" && !companionEmail.trim())
            }
            className="mt-8 w-full rounded-lg bg-brand px-4 py-3 text-base font-semibold text-white transition hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[12rem]"
          >
            {saving ? "保存中…" : "保存する"}
          </button>
          <p className="mt-3 text-sm text-slate-500">
            保存後は公演日程へ戻り、一覧で内容を確認できます。
          </p>
        </section>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}
    </>
  );
}

function PageChrome({ productionId }: { productionId?: string }) {
  const links = [{ href: "/", label: "ホームへ" }];
  if (productionId) {
    links.push({
      href: `/productions/${productionId}`,
      label: "公演日程へ",
    });
  }

  return (
    <header className="border-b border-slate-200 pb-6">
      <PageBackNav links={links} />
      <div className="mt-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          エントリ
        </h1>
        <p className="mt-2 text-base text-slate-600">
          登録内容の確認・削除、および追加ができます。修正は削除してから追加し直してください。
        </p>
      </div>
    </header>
  );
}

export default function NewEntryPage() {
  return (
    <main className="min-h-screen bg-surface px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Suspense
          fallback={
            <>
              <PageChrome />
              <p className="mt-8 text-base text-slate-600" role="status">
                読み込み中…
              </p>
            </>
          }
        >
          <NewEntryForm />
        </Suspense>
      </div>
    </main>
  );
}
