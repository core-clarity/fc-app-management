"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  EntrySummaryLine,
  type EntrySummaryData,
} from "@/components/EntrySummary";
import {
  dateToneClassName,
  formatDateWithDow,
  formatTimeDisplay,
  lotteryResultLabel,
  paymentStatusLabel,
} from "@/lib/labels";
import type { EntryDetailDto } from "@/lib/entry-detail";
import type { EntryPastCopyMeta } from "@/lib/entry-past-copy";

const FEEDBACK_ID = "entry-detail-feedback";

type PastGenre = "concert" | "stage" | "other";

const GENRE_OPTIONS: { value: PastGenre; label: string }[] = [
  { value: "concert", label: "コンサート" },
  { value: "stage", label: "演劇・ミュージカル" },
  { value: "other", label: "その他" },
];

function inputClassName() {
  return "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/25 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";
}

function labelClassName() {
  return "mb-1.5 block text-sm font-medium text-ink";
}

function scrollToFeedback() {
  requestAnimationFrame(() => {
    document
      .getElementById(FEEDBACK_ID)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

export function EntryDetailForm({
  initial,
  pastCopy: initialPastCopy,
}: {
  initial: EntryDetailDto;
  pastCopy: EntryPastCopyMeta;
}) {
  const [entry, setEntry] = useState(initial);
  const [seatInfo, setSeatInfo] = useState(initial.seatInfo ?? "");
  const [baselineSeat, setBaselineSeat] = useState(initial.seatInfo ?? "");
  const [price, setPrice] = useState(
    initial.price == null ? "" : String(initial.price)
  );
  const [baselinePrice, setBaselinePrice] = useState(
    initial.price == null ? "" : String(initial.price)
  );
  const [openRelease, setOpenRelease] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(
    initial.paymentStatus === "completed"
  );
  const [releasePaid, setReleasePaid] = useState(false);

  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [parseNote, setParseNote] = useState<string | null>(null);

  const [pastCopy, setPastCopy] = useState(initialPastCopy);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copyGenre, setCopyGenre] = useState<PastGenre>("concert");
  const [copyOshiId, setCopyOshiId] = useState("");
  const [copyPrice, setCopyPrice] = useState("");
  const [copyTopic, setCopyTopic] = useState("");
  const [copyError, setCopyError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showPastCopySection =
    pastCopy.isPastOwner &&
    (entry.lotteryResult === "won" || !!pastCopy.copiedPastAttendanceId);

  const summary: EntrySummaryData = {
    id: entry.id,
    applicationGroupId: entry.applicationGroupId,
    companionType: entry.companionType,
    companionEmail: entry.companionEmail,
    lotteryResult: entry.lotteryResult,
    paymentStatus: entry.paymentStatus,
    member: {
      id: entry.member.id,
      label: entry.member.label,
      name: entry.member.name,
      symbol: entry.member.symbol,
      themeColor: entry.member.themeColor,
    },
    companionMember: entry.companionMember,
  };

  const seatDirty = seatInfo.trim() !== baselineSeat.trim();
  const priceDirty = price.trim() !== baselinePrice.trim();
  const paymentDirty =
    entry.canEdit &&
    entry.lotteryResult === "won" &&
    paymentCompleted !== (entry.paymentStatus === "completed");
  const releaseDirty = entry.canEdit && openRelease && entry.lotteryResult === "lost";

  const canSave = useMemo(() => {
    if (!entry.canEdit || saving) return false;
    return seatDirty || priceDirty || paymentDirty || releaseDirty;
  }, [entry.canEdit, saving, seatDirty, priceDirty, paymentDirty, releaseDirty]);

  async function onParseSeat(file: File) {
    if (!entry.canEdit) return;
    setParsing(true);
    setError(null);
    setSuccess(null);
    setParseNote(null);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/entries/parse-seat", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "座席の読み取りに失敗しました。"
        );
        scrollToFeedback();
        return;
      }
      if (typeof data.seatInfo === "string" && data.seatInfo.trim()) {
        setSeatInfo(data.seatInfo.trim());
      }
      const notes: string[] = [];
      if (typeof data.seatInfo === "string" && data.seatInfo.trim()) {
        notes.push("座席");
      }
      if (typeof data.price === "number" && Number.isFinite(data.price)) {
        setPrice(String(Math.round(data.price)));
        notes.push("金額");
      }
      if (notes.length > 0) {
        setParseNote(
          `画像から${notes.join("・")}を読み取りました。内容を確認し、必要なら手で直してから保存してください。`
        );
      } else {
        setParseNote(
          "座席・金額を読み取れませんでした。手入力してください。"
        );
      }
    } catch {
      setError("座席の読み取りに失敗しました。");
      scrollToFeedback();
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function onSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const body: Record<string, unknown> = {};
      if (seatDirty) {
        body.seatInfo = seatInfo.trim() || null;
      }
      if (priceDirty) {
        const trimmed = price.trim();
        if (trimmed === "") {
          body.price = null;
        } else {
          const n = Number(trimmed.replace(/,/g, ""));
          if (!Number.isFinite(n)) {
            setError("金額が不正です。");
            scrollToFeedback();
            setSaving(false);
            return;
          }
          body.price = Math.round(n);
        }
      }
      if (releaseDirty) {
        body.lotteryResult = "won";
        body.paymentCompleted = releasePaid;
      } else if (paymentDirty) {
        body.paymentCompleted = paymentCompleted;
      }

      const res = await fetch(`/api/entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "保存に失敗しました。"
        );
        scrollToFeedback();
        return;
      }

      const next = data.entry as EntryDetailDto;
      setEntry(next);
      setSeatInfo(next.seatInfo ?? "");
      setBaselineSeat(next.seatInfo ?? "");
      const nextPrice = next.price == null ? "" : String(next.price);
      setPrice(nextPrice);
      setBaselinePrice(nextPrice);
      setPaymentCompleted(next.paymentStatus === "completed");
      setOpenRelease(false);
      setReleasePaid(false);
      setParseNote(null);
      setSuccess("保存しました。");
      if (
        next.lotteryResult === "won" &&
        pastCopy.isPastOwner &&
        !pastCopy.copiedPastAttendanceId
      ) {
        setPastCopy((prev) => ({
          ...prev,
          canCopyToPast: true,
        }));
      }
      scrollToFeedback();
    } catch {
      setError("保存に失敗しました。");
      scrollToFeedback();
    } finally {
      setSaving(false);
    }
  }

  function openCopyDialog() {
    setCopyError(null);
    setCopyGenre("concert");
    setCopyOshiId("");
    setCopyPrice(entry.price == null ? "" : String(entry.price));
    setCopyTopic("");
    setCopyDialogOpen(true);
  }

  async function onCopyToPast() {
    if (copying || !pastCopy.canCopyToPast) return;
    setCopying(true);
    setCopyError(null);
    try {
      const res = await fetch(`/api/entries/${entry.id}/copy-to-past`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre: copyGenre,
          oshiId: copyOshiId || null,
          price: copyPrice.trim() === "" ? null : copyPrice,
          topic: copyTopic.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && typeof data.pastAttendanceId === "string") {
          setPastCopy((prev) => ({
            ...prev,
            canCopyToPast: false,
            copiedPastAttendanceId: data.pastAttendanceId,
          }));
        }
        setCopyError(
          typeof data.error === "string"
            ? data.error
            : "過去データへのコピーに失敗しました。"
        );
        return;
      }
      setPastCopy((prev) => ({
        ...prev,
        canCopyToPast: false,
        copiedPastAttendanceId:
          typeof data.id === "string" ? data.id : prev.copiedPastAttendanceId,
      }));
      setCopyDialogOpen(false);
      setSuccess("過去データへコピーしました。");
      scrollToFeedback();
    } catch {
      setCopyError("過去データへのコピーに失敗しました。");
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      {!entry.canEdit ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          このエントリは他のユーザーの担当名義です。閲覧のみできます。
        </p>
      ) : null}

      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-ink">公演・申込</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-sm font-medium text-slate-500">公演</dt>
            <dd className="mt-1 text-base text-ink">
              {entry.production.title}
              <span className="mt-0.5 block text-sm text-slate-600">
                {entry.production.artist}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-500">会場・日時</dt>
            <dd className="mt-1 text-base text-ink">
              {entry.performance.venue}
              <span className="mt-0.5 block">
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
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-500">当落・入金</dt>
            <dd className="mt-1 text-base text-ink">
              {lotteryResultLabel(entry.lotteryResult)}
              {entry.lotteryResult === "won" ? (
                <span className="ml-2 text-slate-600">
                  / {paymentStatusLabel(entry.paymentStatus)}
                </span>
              ) : null}
              {entry.resultNotifiedAt ? (
                <span className="mt-0.5 block text-sm text-slate-500">
                  通知日: {entry.resultNotifiedAt}
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
        <div className="mt-5 border-t border-slate-100 pt-5">
          <EntrySummaryLine entry={summary} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-ink">座席・金額</h2>
        <p className="mt-2 text-sm text-slate-600">
          手入力するか、チケット画像から読み取って自動入力できます。金額は券面に読み取れる場合のみ入ります。画像自体は保存しません。
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="seatInfo" className={labelClassName()}>
              座席
            </label>
            <input
              id="seatInfo"
              type="text"
              value={seatInfo}
              onChange={(e) => setSeatInfo(e.target.value)}
              disabled={!entry.canEdit || saving || parsing}
              placeholder="例: 1階 バルコニー 12列 5番"
              className={inputClassName()}
            />
          </div>
          <div>
            <label htmlFor="ticketPrice" className={labelClassName()}>
              金額（円・任意）
            </label>
            <input
              id="ticketPrice"
              type="text"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={!entry.canEdit || saving || parsing}
              placeholder="例: 12000"
              className={inputClassName()}
            />
          </div>
        </div>

        {entry.canEdit ? (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onParseSeat(file);
              }}
            />
            <button
              type="button"
              disabled={parsing || saving}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              {parsing ? "読み取り中…" : "カメラ／画像から読み取り"}
            </button>
            {parseNote ? (
              <p className="text-sm text-slate-600">{parseNote}</p>
            ) : (
              <p className="text-sm text-slate-500">
                読み取り後もフィールドは自由に編集できます。
              </p>
            )}
          </div>
        ) : null}
      </section>

      {entry.lotteryResult === "won" && entry.canEdit ? (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-ink">入金</h2>
          <p className="mt-2 text-sm text-slate-600">
            主操作は当落画面です。ここでも変更できます。
          </p>
          <label className="mt-4 inline-flex items-center gap-2 text-base text-ink">
            <input
              type="checkbox"
              checked={paymentCompleted}
              onChange={(e) => setPaymentCompleted(e.target.checked)}
              disabled={saving}
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            入金済み
          </label>
        </section>
      ) : null}

      {entry.lotteryResult === "lost" && entry.canEdit ? (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-ink">制作開放</h2>
          <p className="mt-2 text-sm text-slate-600">
            落選から当選に変更します（突然の追加当選向け）。
          </p>
          <label className="mt-4 inline-flex items-center gap-2 text-base text-ink">
            <input
              type="checkbox"
              checked={openRelease}
              onChange={(e) => setOpenRelease(e.target.checked)}
              disabled={saving}
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            制作開放する（落選 → 当選）
          </label>
          {openRelease ? (
            <label className="mt-3 flex items-center gap-2 text-base text-ink">
              <input
                type="checkbox"
                checked={releasePaid}
                onChange={(e) => setReleasePaid(e.target.checked)}
                disabled={saving}
                className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
              />
              あわせて入金済みにする
            </label>
          ) : null}
        </section>
      ) : null}

      {showPastCopySection ? (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-ink">過去データへコピー</h2>
          <p className="mt-2 text-sm text-slate-600">
            当選エントリを生涯ログ（過去データ）へ追加します。座席・金額はエントリに保存済みの値を使います（コピー時に金額は変更可）。未保存の変更は含まれないため、必要なら先に保存してください。
          </p>
          {pastCopy.copiedPastAttendanceId ? (
            <p className="mt-4 text-sm text-emerald-800">
              コピー済みです。{" "}
              <Link
                href="/analytics/past/list"
                className="font-medium text-brand-dark underline-offset-2 hover:underline"
              >
                過去データ一覧を開く
              </Link>
            </p>
          ) : pastCopy.canCopyToPast ? (
            <button
              type="button"
              onClick={openCopyDialog}
              disabled={saving || copying || seatDirty || priceDirty}
              className="mt-4 inline-flex rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              過去データへコピー…
            </button>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              当選になるとコピーできます。
            </p>
          )}
          {seatDirty || priceDirty ? (
            <p className="mt-2 text-sm text-amber-800">
              座席・金額に未保存の変更があります。コピー前に保存してください。
            </p>
          ) : null}
        </section>
      ) : null}

      {copyDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="copy-to-past-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h3
                id="copy-to-past-title"
                className="text-lg font-semibold text-ink"
              >
                過去データへコピー
              </h3>
              <button
                type="button"
                onClick={() => setCopyDialogOpen(false)}
                disabled={copying}
                className="text-sm text-slate-500 hover:text-ink disabled:opacity-60"
              >
                閉じる
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {entry.production.title}（{entry.performance.venue} /{" "}
              {formatDateWithDow(entry.performance.performanceDate)}）
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="copyGenre" className={labelClassName()}>
                  ジャンル
                </label>
                <select
                  id="copyGenre"
                  value={copyGenre}
                  onChange={(e) => setCopyGenre(e.target.value as PastGenre)}
                  disabled={copying}
                  className={inputClassName()}
                >
                  {GENRE_OPTIONS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="copyOshiId" className={labelClassName()}>
                  推し（任意）
                </label>
                <select
                  id="copyOshiId"
                  value={copyOshiId}
                  onChange={(e) => setCopyOshiId(e.target.value)}
                  disabled={copying}
                  className={inputClassName()}
                >
                  <option value="">未設定</option>
                  {pastCopy.oshiList.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="copyPrice" className={labelClassName()}>
                  金額（円・任意）
                </label>
                <input
                  id="copyPrice"
                  type="text"
                  inputMode="numeric"
                  value={copyPrice}
                  onChange={(e) => setCopyPrice(e.target.value)}
                  disabled={copying}
                  placeholder="例: 12000"
                  className={inputClassName()}
                />
              </div>
              <div>
                <label htmlFor="copyTopic" className={labelClassName()}>
                  Topic（任意）
                </label>
                <input
                  id="copyTopic"
                  type="text"
                  value={copyTopic}
                  onChange={(e) => setCopyTopic(e.target.value)}
                  disabled={copying}
                  className={inputClassName()}
                />
              </div>
            </div>
            {copyError ? (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {copyError}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCopyDialogOpen(false)}
                disabled={copying}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-60"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => void onCopyToPast()}
                disabled={copying}
                className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {copying ? "コピー中…" : "コピーする"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div id={FEEDBACK_ID} className="space-y-3">
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {success}
          </p>
        ) : null}
      </div>

      {entry.canEdit ? (
        <div className="flex justify-end pb-8">
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={!canSave}
            className="inline-flex rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "保存中…" : "保存する"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
