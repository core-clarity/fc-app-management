"use client";

import { useMemo, useState } from "react";
import {
  EntrySummaryLine,
  type EntrySummaryData,
} from "@/components/EntrySummary";
import { MemberSymbol } from "@/components/MemberSymbol";
import {
  dateToneClassName,
  formatDateWithDow,
  formatTimeDisplay,
  lotteryResultLabel,
  paymentStatusLabel,
} from "@/lib/labels";
import type { LotteryContext, LotteryResult } from "@/lib/lottery";

const FEEDBACK_ID = "lottery-save-feedback";

function inputClassName() {
  return "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/25";
}

function labelClassName() {
  return "mb-1.5 block text-sm font-medium text-ink";
}

const RESULT_OPTIONS: { value: LotteryResult; label: string }[] = [
  { value: "pending", label: "未設定" },
  { value: "won", label: "当選" },
  { value: "lost", label: "落選" },
];

function isPaidStatus(status: string): boolean {
  return status === "completed";
}

function scrollToFeedback() {
  requestAnimationFrame(() => {
    document
      .getElementById(FEEDBACK_ID)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

export function LotteryForm({ initial }: { initial: LotteryContext }) {
  const [entries, setEntries] = useState(initial.entries);
  const [selections, setSelections] = useState<Record<string, LotteryResult>>(
    () =>
      Object.fromEntries(
        initial.entries.map((e) => [e.id, e.lotteryResult])
      ) as Record<string, LotteryResult>
  );
  const [baseline, setBaseline] = useState<Record<string, LotteryResult>>(
    () =>
      Object.fromEntries(
        initial.entries.map((e) => [e.id, e.lotteryResult])
      ) as Record<string, LotteryResult>
  );
  const [paymentPaid, setPaymentPaid] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        initial.entries.map((e) => [e.id, isPaidStatus(e.paymentStatus)])
      )
  );
  const [baselinePayment, setBaselinePayment] = useState<
    Record<string, boolean>
  >(() =>
    Object.fromEntries(
      initial.entries.map((e) => [e.id, isPaidStatus(e.paymentStatus)])
    )
  );
  const [resultNotifiedAt, setResultNotifiedAt] = useState(() => {
    const dates = initial.entries
      .map((e) => e.resultNotifiedAt)
      .filter((d): d is string => !!d);
    return dates[0] ?? "";
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const dirtyUpdates = useMemo(() => {
    return entries
      .filter((e) => {
        const nextResult = selections[e.id] ?? "pending";
        const resultChanged = nextResult !== baseline[e.id];
        const nextPaid =
          nextResult === "won" ? (paymentPaid[e.id] ?? false) : false;
        const baselinePaid =
          baseline[e.id] === "won" ? (baselinePayment[e.id] ?? false) : false;
        const paymentChanged = nextPaid !== baselinePaid;
        return resultChanged || paymentChanged;
      })
      .map((e) => {
        const lotteryResult = selections[e.id] ?? "pending";
        return {
          entryId: e.id,
          lotteryResult,
          paymentCompleted:
            lotteryResult === "won" ? (paymentPaid[e.id] ?? false) : false,
        };
      });
  }, [entries, selections, baseline, paymentPaid, baselinePayment]);

  const hasResultChange = useMemo(
    () =>
      dirtyUpdates.some((u) => {
        const entry = entries.find((e) => e.id === u.entryId);
        return entry ? u.lotteryResult !== baseline[entry.id] : false;
      }),
    [dirtyUpdates, entries, baseline]
  );

  function setResult(entryId: string, value: LotteryResult) {
    setSelections((prev) => ({ ...prev, [entryId]: value }));
    if (value === "won") {
      setPaymentPaid((prev) => ({
        ...prev,
        [entryId]: baselinePayment[entryId] ?? false,
      }));
    } else {
      setPaymentPaid((prev) => ({ ...prev, [entryId]: false }));
    }
    setSuccess(null);
  }

  function setPaid(entryId: string, paid: boolean) {
    setPaymentPaid((prev) => ({ ...prev, [entryId]: paid }));
    setSuccess(null);
  }

  async function onSave() {
    if (saving) return;
    setError(null);
    setSuccess(null);

    if (dirtyUpdates.length === 0) {
      setError("変更したエントリがありません。当落または入金を変更してから保存してください。");
      scrollToFeedback();
      return;
    }

    if (hasResultChange && !resultNotifiedAt.trim()) {
      setError("通知日を入力してください。");
      scrollToFeedback();
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        updates: dirtyUpdates,
      };
      if (hasResultChange) {
        body.resultNotifiedAt = resultNotifiedAt.trim();
      }

      const res = await fetch(`/api/lottery/${initial.production.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : "保存に失敗しました。"
        );
        scrollToFeedback();
        return;
      }

      const nextBaseline = { ...baseline };
      const nextBaselinePayment = { ...baselinePayment };
      const nextPaymentPaid = { ...paymentPaid };
      const nextEntries = entries.map((e) => {
        const upd = dirtyUpdates.find((u) => u.entryId === e.id);
        if (!upd) return e;
        nextBaseline[e.id] = upd.lotteryResult;
        const paid =
          upd.lotteryResult === "won" ? upd.paymentCompleted : false;
        nextBaselinePayment[e.id] = paid;
        nextPaymentPaid[e.id] = paid;
        return {
          ...e,
          lotteryResult: upd.lotteryResult,
          resultNotifiedAt: hasResultChange
            ? resultNotifiedAt.trim()
            : e.resultNotifiedAt,
          paymentStatus:
            upd.lotteryResult === "won"
              ? paid
                ? ("completed" as const)
                : ("pending" as const)
              : ("not_required" as const),
          paidAt: paid
            ? new Date().toLocaleDateString("en-CA", {
                timeZone: "Asia/Tokyo",
              })
            : null,
        };
      });
      setEntries(nextEntries);
      setBaseline(nextBaseline);
      setSelections({ ...nextBaseline });
      setBaselinePayment(nextBaselinePayment);
      setPaymentPaid(nextPaymentPaid);
      setSuccess(
        `${typeof data.updatedCount === "number" ? data.updatedCount : dirtyUpdates.length} 件を保存しました。`
      );
      scrollToFeedback();
    } catch {
      setError("通信エラーが発生しました。もう一度お試しください。");
      scrollToFeedback();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-ink">対象ツアー</h2>
        <p className="mt-3 text-base font-medium text-ink">
          {initial.production.title}
        </p>
        <p className="mt-1 text-sm text-slate-600">{initial.production.artist}</p>
        <p className="mt-3 text-sm text-slate-600">
          自分の担当名義のエントリのみ表示・更新できます。当選行では入金済みも同時に記録できます。未変更の行はそのまま残ります。
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8">
        <label htmlFor="resultNotifiedAt" className={labelClassName()}>
          通知日
          <span className="ml-1 text-red-600">
            {hasResultChange ? "（当落変更時は必須）" : "（入金のみ更新なら不要）"}
          </span>
        </label>
        <input
          id="resultNotifiedAt"
          type="date"
          value={resultNotifiedAt}
          onChange={(e) => {
            setResultNotifiedAt(e.target.value);
            setSuccess(null);
          }}
          className={`${inputClassName()} sm:max-w-xs`}
        />
        <p className="mt-2 text-sm text-slate-500">
          当落結果を変更して保存するエントリに、同じ通知日が適用されます。入金済みの日時は保存した日時になります。
        </p>

        <div id={FEEDBACK_ID} className="mt-4">
          {error ? (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </p>
          ) : null}
          {success ? (
            <p
              role="status"
              className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
            >
              {success}
            </p>
          ) : null}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-ink">
          エントリ（{entries.length} 件）
        </h2>

        {entries.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            担当名義のエントリがありません。公演日程からエントリを追加してください。
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-slate-100">
            {entries.map((entry) => {
              const summary: EntrySummaryData = {
                id: entry.id,
                applicationGroupId: entry.applicationGroupId,
                companionType: entry.companionType,
                companionEmail: entry.companionEmail,
                member: entry.member,
                companionMember: entry.companionMember,
                lotteryResult: entry.lotteryResult,
                paymentStatus: entry.paymentStatus,
              };
              const selected = selections[entry.id] ?? "pending";
              const paid = paymentPaid[entry.id] ?? false;
              const resultChanged = selected !== baseline[entry.id];
              const baselinePaid =
                baseline[entry.id] === "won"
                  ? (baselinePayment[entry.id] ?? false)
                  : false;
              const nextPaid = selected === "won" ? paid : false;
              const dirty = resultChanged || nextPaid !== baselinePaid;

              return (
                <li key={entry.id} className="py-5 first:pt-0 last:pb-0">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <MemberSymbol
                        symbol={entry.member.symbol}
                        themeColor={entry.member.themeColor}
                        size={22}
                      />
                      <p className="text-base font-medium text-ink">
                        <span
                          className={dateToneClassName(
                            entry.performance.performanceDate
                          )}
                        >
                          {formatDateWithDow(entry.performance.performanceDate)}
                        </span>
                        <span className="ml-2 text-slate-600">
                          {formatTimeDisplay(entry.performance.startTime)}
                        </span>
                      </p>
                      {dirty ? (
                        <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                          変更あり
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-slate-600">
                      {entry.performance.venue}
                    </p>
                    <EntrySummaryLine entry={summary} />
                    <p className="text-xs text-slate-500">
                      現在の保存値: {lotteryResultLabel(baseline[entry.id])}
                      {baseline[entry.id] === "won"
                        ? `・${paymentStatusLabel(
                            baselinePayment[entry.id]
                              ? "completed"
                              : "pending"
                          )}`
                        : ""}
                      {entry.resultNotifiedAt
                        ? `（通知日 ${entry.resultNotifiedAt}）`
                        : ""}
                    </p>
                    <fieldset>
                      <legend className="sr-only">
                        {entry.member.label}の当落
                      </legend>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        {RESULT_OPTIONS.map((opt) => (
                          <label
                            key={opt.value}
                            className="inline-flex items-center gap-2 text-base text-ink"
                          >
                            <input
                              type="radio"
                              name={`result-${entry.id}`}
                              value={opt.value}
                              checked={selected === opt.value}
                              onChange={() => setResult(entry.id, opt.value)}
                              className="h-4 w-4 accent-[var(--brand)]"
                            />
                            {opt.label}
                          </label>
                        ))}
                        {selected === "won" ? (
                          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-base text-ink">
                            <input
                              type="checkbox"
                              checked={paid}
                              onChange={(e) =>
                                setPaid(entry.id, e.target.checked)
                              }
                              className="h-4 w-4 accent-[var(--brand)]"
                            />
                            <span
                              className={
                                paid
                                  ? "font-medium text-emerald-700"
                                  : "text-amber-800"
                              }
                            >
                              {paid ? "入金済み" : "入金未"}
                            </span>
                          </label>
                        ) : null}
                      </div>
                    </fieldset>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <button
          type="button"
          onClick={() => void onSave()}
          disabled={saving || entries.length === 0 || dirtyUpdates.length === 0}
          className="mt-8 w-full rounded-lg bg-brand px-4 py-3 text-base font-semibold text-white transition hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[12rem]"
        >
          {saving
            ? "保存中…"
            : dirtyUpdates.length > 0
              ? `変更 ${dirtyUpdates.length} 件を保存`
              : "保存する"}
        </button>
      </section>
    </>
  );
}
