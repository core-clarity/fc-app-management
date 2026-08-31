"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageBackNav } from "@/components/PageBackNav";
import {
  dateToneClassName,
  formatDateWithDow,
  formatTimeDisplay,
} from "@/lib/labels";

type CompanionType = "fc_member" | "general_email" | "none";

type PerformanceOption = {
  id: string;
  venue: string;
  performanceDate: string;
  startTime: string;
};

type MemberOption = {
  id: string;
  label: string;
  name: string;
};

type GroupContext = {
  production: {
    id: string;
    title: string;
    artist: string;
    companionTiming: "at_entry" | "before_show";
    allowsGeneralCompanion: boolean;
  };
  performances: PerformanceOption[];
  members: MemberOption[];
};

function inputClassName() {
  return "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/25 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";
}

function labelClassName() {
  return "mb-1.5 block text-sm font-medium text-ink";
}

function GroupEntryForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productionId = searchParams.get("productionId");
  const initialPerformanceId = searchParams.get("performanceId");

  const [ctx, setCtx] = useState<GroupContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [firstChoiceId, setFirstChoiceId] = useState("");
  const [otherIds, setOtherIds] = useState<string[]>([]);
  const [memberId, setMemberId] = useState("");
  const [companionMode, setCompanionMode] =
    useState<CompanionType>("none");
  const [companionMemberId, setCompanionMemberId] = useState("");
  const [companionEmail, setCompanionEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productionId) {
      setLoading(false);
      setLoadError("productionId が指定されていません。");
      return;
    }
    const requestedProductionId = productionId;

    let cancelled = false;
    async function loadContext() {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(
          `/api/entries?productionId=${encodeURIComponent(
            requestedProductionId
          )}`
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : "公演情報の取得に失敗しました。"
          );
        }
        if (cancelled) return;
        const next = data as GroupContext;
        setCtx(next);
        const initialChoice =
          initialPerformanceId &&
          next.performances.some((p) => p.id === initialPerformanceId)
            ? initialPerformanceId
            : next.performances[0]?.id ?? "";
        setFirstChoiceId(initialChoice);
        setCompanionMode(
          next.production.companionTiming === "before_show" ? "none" : "fc_member"
        );
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "通信エラーが発生しました。"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadContext();
    return () => {
      cancelled = true;
    };
  }, [initialPerformanceId, productionId]);

  const otherPerformances = useMemo(
    () => ctx?.performances.filter((p) => p.id !== firstChoiceId) ?? [],
    [ctx, firstChoiceId]
  );

  const selectedOtherCount = otherIds.length;

  function changeFirstChoice(id: string) {
    setFirstChoiceId(id);
    setOtherIds((prev) => prev.filter((otherId) => otherId !== id));
    setError(null);
  }

  function toggleOther(id: string, checked: boolean) {
    setOtherIds((prev) =>
      checked
        ? prev.includes(id)
          ? prev
          : [...prev, id]
        : prev.filter((otherId) => otherId !== id)
    );
    setError(null);
  }

  async function onSave() {
    if (saving || !ctx) return;
    setError(null);

    if (!firstChoiceId) {
      setError("第1希望を選択してください。");
      return;
    }
    if (otherIds.length === 0) {
      setError("第1希望以外の公演を1件以上選択してください。");
      return;
    }
    if (!memberId) {
      setError("申込名義を選択してください。");
      return;
    }
    if (companionMode === "fc_member" && !companionMemberId) {
      setError("同行者の名義を選択してください。");
      return;
    }
    if (companionMode === "general_email" && !companionEmail.trim()) {
      setError("同行者のメールアドレスを入力してください。");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        applicationMode: "preference",
        productionId: ctx.production.id,
        firstChoicePerformanceId: firstChoiceId,
        otherPerformanceIds: otherIds,
        memberId,
        companionType: companionMode,
      };
      if (companionMode === "fc_member") {
        body.companionMemberId = companionMemberId;
      } else if (companionMode === "general_email") {
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
          typeof data.error === "string"
            ? data.error
            : "希望申込の保存に失敗しました。"
        );
        return;
      }

      router.push(`/productions/${ctx.production.id}`);
      router.refresh();
    } catch {
      setError("通信エラーが発生しました。もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <PageChrome productionId={productionId} />
        <p className="mt-8 text-base text-slate-600" role="status">
          読み込み中…
        </p>
      </>
    );
  }

  if (loadError || !ctx) {
    return (
      <>
        <PageChrome productionId={productionId} />
        <p
          className="mt-8 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {loadError ?? "データがありません。"}
        </p>
      </>
    );
  }

  return (
    <>
      <PageChrome productionId={ctx.production.id} />

      <section className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-ink">希望申込をまとめて登録</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          第1希望とその他の希望を同じ申込グループとして登録します。第2希望・第3希望の順位は保存せず、当落管理では同一申込として扱います。
        </p>
        <p className="mt-3 text-base font-medium text-ink">
          {ctx.production.title}
        </p>
        <p className="mt-1 text-sm text-slate-600">{ctx.production.artist}</p>
      </section>

      <section className="mt-6 space-y-6 rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8">
        <div>
          <label htmlFor="groupMemberId" className={labelClassName()}>
            申込名義
          </label>
          <select
            id="groupMemberId"
            value={memberId}
            onChange={(e) => {
              setMemberId(e.target.value);
              if (e.target.value === companionMemberId) {
                setCompanionMemberId("");
              }
              setError(null);
            }}
            disabled={saving}
            className={inputClassName()}
          >
            <option value="">選択してください</option>
            {ctx.members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.label}（{member.name}）
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="firstChoicePerformance" className={labelClassName()}>
            第1希望
          </label>
          <select
            id="firstChoicePerformance"
            value={firstChoiceId}
            onChange={(e) => changeFirstChoice(e.target.value)}
            disabled={saving}
            className={inputClassName()}
          >
            <option value="">選択してください</option>
            {ctx.performances.map((performance) => (
              <option key={performance.id} value={performance.id}>
                {performance.performanceDate} {formatTimeDisplay(performance.startTime)}{" "}
                {performance.venue}
              </option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className={labelClassName()}>
            その他の希望
            <span className="ml-1 text-slate-500">（複数選択可）</span>
          </legend>
          <div className="space-y-2">
            {otherPerformances.map((performance) => {
              const checked = otherIds.includes(performance.id);
              return (
                <label
                  key={performance.id}
                  className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-base text-ink"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      toggleOther(performance.id, e.target.checked)
                    }
                    disabled={saving}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                  />
                  <span>
                    <span
                      className={dateToneClassName(performance.performanceDate)}
                    >
                      {formatDateWithDow(performance.performanceDate)}
                    </span>{" "}
                    {formatTimeDisplay(performance.startTime)}
                    <span className="mt-0.5 block text-sm text-slate-600">
                      {performance.venue}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          {otherPerformances.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              第1希望以外に選択できる公演がありません。
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              {selectedOtherCount} 件をその他の希望として選択中
            </p>
          )}
        </fieldset>

        <fieldset>
          <legend className={labelClassName()}>
            同行者
            <span className="ml-1 text-slate-500">（全希望公演に適用）</span>
          </legend>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-base text-ink">
              <input
                type="radio"
                name="groupCompanionMode"
                checked={companionMode === "none"}
                onChange={() => setCompanionMode("none")}
                disabled={saving}
                className="h-4 w-4 accent-[var(--brand)]"
              />
              同行者なし（ソロ）
            </label>
            <label className="flex items-center gap-2 text-base text-ink">
              <input
                type="radio"
                name="groupCompanionMode"
                checked={companionMode === "fc_member"}
                onChange={() => setCompanionMode("fc_member")}
                disabled={saving}
                className="h-4 w-4 accent-[var(--brand)]"
              />
              FC名義から選ぶ
            </label>
            {ctx.production.allowsGeneralCompanion ? (
              <label className="flex items-center gap-2 text-base text-ink">
                <input
                  type="radio"
                  name="groupCompanionMode"
                  checked={companionMode === "general_email"}
                  onChange={() => setCompanionMode("general_email")}
                  disabled={saving}
                  className="h-4 w-4 accent-[var(--brand)]"
                />
                一般同行（メールアドレス）
              </label>
            ) : null}
          </div>

          {companionMode === "fc_member" ? (
            <div className="mt-4">
              <label htmlFor="groupCompanionMemberId" className={labelClassName()}>
                同行者名義
              </label>
              <select
                id="groupCompanionMemberId"
                value={companionMemberId}
                onChange={(e) => setCompanionMemberId(e.target.value)}
                disabled={saving}
                className={inputClassName()}
              >
                <option value="">選択してください</option>
                {ctx.members
                  .filter((member) => member.id !== memberId)
                  .map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.label}（{member.name}）
                    </option>
                  ))}
              </select>
            </div>
          ) : null}

          {companionMode === "general_email" ? (
            <div className="mt-4">
              <label htmlFor="groupCompanionEmail" className={labelClassName()}>
                同行者メールアドレス
              </label>
              <input
                id="groupCompanionEmail"
                type="email"
                value={companionEmail}
                onChange={(e) => setCompanionEmail(e.target.value)}
                disabled={saving}
                placeholder="example@example.com"
                className={inputClassName()}
              />
            </div>
          ) : null}
        </fieldset>

        {error ? (
          <p
            className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void onSave()}
          disabled={saving || otherIds.length === 0}
          className="w-full rounded-lg bg-brand px-4 py-3 text-base font-semibold text-white transition hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[12rem]"
        >
          {saving ? "保存中…" : "希望申込を登録する"}
        </button>
      </section>
    </>
  );
}

function PageChrome({ productionId }: { productionId: string | null }) {
  return (
    <header className="border-b border-slate-200 pb-6">
      <PageBackNav
        links={[
          { href: "/", label: "ホームへ", reloadDocument: true },
          ...(productionId
            ? [
                {
                  href: `/productions/${productionId}`,
                  label: "公演日程へ",
                },
              ]
            : []),
        ]}
      />
      <div className="mt-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          希望申込
        </h1>
        <p className="mt-2 text-base text-slate-600">
          第1希望とその他の希望をまとめて登録します。
        </p>
      </div>
    </header>
  );
}

export default function GroupEntryPage() {
  return (
    <main className="min-h-screen bg-surface px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Suspense
          fallback={
            <>
              <PageChrome productionId={null} />
              <p className="mt-8 text-base text-slate-600" role="status">
                読み込み中…
              </p>
            </>
          }
        >
          <GroupEntryForm />
        </Suspense>
      </div>
    </main>
  );
}
