"use client";

import type { ReactNode, RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";

type PastGenre = "concert" | "stage" | "other";

type PastRow = {
  id: string;
  artist: string | null;
  title: string;
  venue: string | null;
  city: string | null;
  performanceDate: string | null;
  startTime: string | null;
  seatInfo: string | null;
  price: number | null;
  genre: PastGenre;
  oshiId: string | null;
  topic: string | null;
  sourceType: string;
  sourceImageIndex: string | null;
  sourceFile: string | null;
  notes: string | null;
  updatedAt: string;
};

type Oshi = { id: string; label: string; themeColor: string };
type RenameHint = { name: string; count: number };

type ListPayload = {
  canEdit: boolean;
  rows: PastRow[];
  oshiList: Oshi[];
  renameHints: { artists: RenameHint[]; venues: RenameHint[] };
};

type FilterKey = "all" | "artist_null" | "venue_null" | "price_null" | "date_null";

const GENRE_LABEL: Record<PastGenre, string> = {
  concert: "コンサート",
  stage: "演劇・ミュージカル",
  other: "その他",
};

const emptyForm = {
  artist: "",
  title: "",
  venue: "",
  city: "",
  performanceDate: "",
  startTime: "",
  seatInfo: "",
  price: "",
  genre: "concert" as PastGenre,
  oshiId: "",
  topic: "",
  notes: "",
};

type FormState = typeof emptyForm;

function rowToForm(row: PastRow): FormState {
  return {
    artist: row.artist ?? "",
    title: row.title,
    venue: row.venue ?? "",
    city: row.city ?? "",
    performanceDate: row.performanceDate ?? "",
    startTime: row.startTime?.slice(0, 5) ?? "",
    seatInfo: row.seatInfo ?? "",
    price: row.price == null ? "" : String(row.price),
    genre: row.genre,
    oshiId: row.oshiId ?? "",
    topic: row.topic ?? "",
    notes: row.notes ?? "",
  };
}

function formToBody(form: FormState) {
  return {
    artist: form.artist,
    title: form.title,
    venue: form.venue,
    city: form.city,
    performanceDate: form.performanceDate,
    startTime: form.startTime,
    seatInfo: form.seatInfo,
    price: form.price === "" ? null : form.price,
    genre: form.genre,
    oshiId: form.oshiId || null,
    topic: form.topic,
    notes: form.notes,
  };
}

export function PastListClient() {
  const [data, setData] = useState<ListPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [pending, startTransition] = useTransition();

  const [editRow, setEditRow] = useState<PastRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseNote, setParseNote] = useState<string | null>(null);
  const [scanImageHash, setScanImageHash] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [renameField, setRenameField] = useState<"artist" | "venue">("artist");
  const [renameFrom, setRenameFrom] = useState("");
  const [renameTo, setRenameTo] = useState("");

  const load = useCallback(
    (nextQ = q, nextFilter = filter) => {
      startTransition(async () => {
        setError(null);
        const params = new URLSearchParams();
        if (nextQ.trim()) params.set("q", nextQ.trim());
        if (nextFilter !== "all") params.set("filter", nextFilter);
        const res = await fetch(`/api/past-attendances?${params.toString()}`);
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          setError(body?.error ?? "読み込みに失敗しました");
          return;
        }
        const json = (await res.json()) as ListPayload;
        setData(json);
      });
    },
    [q, filter]
  );

  useEffect(() => {
    load();
    // 初回のみ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hints = useMemo(() => {
    if (!data) return [];
    return renameField === "artist"
      ? data.renameHints.artists
      : data.renameHints.venues;
  }, [data, renameField]);

  const oshiById = useMemo(() => {
    const map = new Map<string, Oshi>();
    for (const o of data?.oshiList ?? []) map.set(o.id, o);
    return map;
  }, [data?.oshiList]);

  async function saveEdit() {
    if (!editRow || !data?.canEdit) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/past-attendances/${editRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formToBody(form)),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "更新に失敗しました");
      }
      setEditRow(null);
      setMessage("更新しました");
      load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function saveCreate() {
    if (!data?.canEdit) return;
    setBusy(true);
    setMessage(null);
    try {
      const body: Record<string, unknown> = formToBody(form);
      if (scanImageHash) {
        body.sourceType = "ticket_scan";
        body.sourceImageIndex = scanImageHash;
      }
      const res = await fetch("/api/past-attendances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "作成に失敗しました");
      }
      setCreating(false);
      setForm(emptyForm);
      setScanImageHash(null);
      setParseNote(null);
      setMessage("追加しました");
      load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "作成に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function onParseTicket(file: File) {
    if (!data?.canEdit) return;
    setParsing(true);
    setMessage(null);
    setParseNote(null);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/past-attendances/parse-ticket", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "券面の読み取りに失敗しました。"
        );
      }

      const filled: string[] = [];
      setForm((prev) => {
        const next = { ...prev };
        if (typeof data.artist === "string" && data.artist.trim()) {
          next.artist = data.artist.trim();
          filled.push("アーティスト");
        }
        if (typeof data.title === "string" && data.title.trim()) {
          next.title = data.title.trim();
          filled.push("タイトル");
        }
        if (typeof data.venue === "string" && data.venue.trim()) {
          next.venue = data.venue.trim();
          filled.push("会場");
        }
        if (typeof data.city === "string" && data.city.trim()) {
          next.city = data.city.trim();
          filled.push("都市");
        }
        if (
          typeof data.performanceDate === "string" &&
          data.performanceDate.trim()
        ) {
          next.performanceDate = data.performanceDate.trim();
          filled.push("日付");
        }
        if (typeof data.startTime === "string" && data.startTime.trim()) {
          next.startTime = data.startTime.trim();
          filled.push("開演");
        }
        if (typeof data.seatInfo === "string" && data.seatInfo.trim()) {
          next.seatInfo = data.seatInfo.trim();
          filled.push("座席");
        }
        if (typeof data.price === "number" && Number.isFinite(data.price)) {
          next.price = String(Math.round(data.price));
          filled.push("金額");
        }
        if (
          data.genre === "concert" ||
          data.genre === "stage" ||
          data.genre === "other"
        ) {
          next.genre = data.genre;
          filled.push("ジャンル");
        }
        return next;
      });

      if (typeof data.imageHash === "string" && data.imageHash.trim()) {
        setScanImageHash(data.imageHash.trim());
      }

      if (filled.length > 0) {
        setParseNote(
          `券面から${filled.join("・")}を読み取りました。内容を確認し、必要なら手で直してから保存してください。`
        );
      } else {
        setParseNote(
          "券面から項目を読み取れませんでした。手入力してください。"
        );
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "券面の読み取りに失敗しました");
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function closeDialog() {
    setEditRow(null);
    setCreating(false);
    setScanImageHash(null);
    setParseNote(null);
  }

  async function removeRow(row: PastRow) {
    if (!data?.canEdit) return;
    if (
      !window.confirm(
        `「${row.title}」を削除しますか？\n（無効な券面・裏写りなどはこの操作で削除）`
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/past-attendances/${row.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "削除に失敗しました");
      }
      setMessage("削除しました");
      load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function runRename() {
    if (!data?.canEdit) return;
    if (!renameFrom.trim()) {
      setMessage("置換元を選んでください");
      return;
    }
    if (
      !window.confirm(
        `${renameField === "artist" ? "アーティスト" : "会場"}「${renameFrom}」を「${renameTo || "(空＝不明)"}」に一括置換します。よろしいですか？`
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/past-attendances/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field: renameField,
          from: renameFrom,
          to: renameTo,
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        updated?: number;
      } | null;
      if (!res.ok) {
        throw new Error(body?.error ?? "一括置換に失敗しました");
      }
      setMessage(`${body?.updated ?? 0} 件を置換しました`);
      setRenameFrom("");
      setRenameTo("");
      load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "一括置換に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") load(q, filter);
            }}
            placeholder="タイトル / アーティスト / 会場 / 都市 / 備考"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
          />
          <select
            value={filter}
            onChange={(e) => {
              const next = e.target.value as FilterKey;
              setFilter(next);
              load(q, next);
            }}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            <option value="all">すべて</option>
            <option value="artist_null">artist 不明</option>
            <option value="venue_null">会場 不明</option>
            <option value="price_null">金額 不明</option>
            <option value="date_null">日付 不明</option>
          </select>
          <button
            type="button"
            onClick={() => load(q, filter)}
            className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            検索
          </button>
        </div>
        {data?.canEdit ? (
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setForm(emptyForm);
              setEditRow(null);
              setScanImageHash(null);
              setParseNote(null);
            }}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400"
          >
            新規追加
          </button>
        ) : null}
      </div>

      {message ? (
        <p className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-sky-200">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-rose-800 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}
      {!data?.canEdit && data ? (
        <p className="text-sm text-amber-200/90">
          読み取り専用です（編集・削除・名寄せは Katsura のみ）。
        </p>
      ) : null}

      {data?.canEdit ? (
        <section className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-4">
          <h2 className="text-sm font-semibold text-slate-200">
            表記ゆれ・一括置換
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            例: 「20TH CENTURY」→「20th Century」、「国立代々木競技場
            第一体育館」→「国立代々木競技場第一体育館」
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="text-xs text-slate-400">
              項目
              <select
                value={renameField}
                onChange={(e) => {
                  setRenameField(e.target.value as "artist" | "venue");
                  setRenameFrom("");
                  setRenameTo("");
                }}
                className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              >
                <option value="artist">アーティスト</option>
                <option value="venue">会場</option>
              </select>
            </label>
            <label className="min-w-0 flex-1 text-xs text-slate-400">
              置換元（現在の表記）
              <select
                value={renameFrom}
                onChange={(e) => {
                  setRenameFrom(e.target.value);
                  setRenameTo(e.target.value);
                }}
                className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">選択…</option>
                {hints.map((h) => (
                  <option key={h.name} value={h.name}>
                    {h.name}（{h.count}）
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 flex-1 text-xs text-slate-400">
              置換先（正式表記）
              <input
                value={renameTo}
                onChange={(e) => setRenameTo(e.target.value)}
                list="rename-to-hints"
                className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                placeholder="空にすると null"
              />
              <datalist id="rename-to-hints">
                {hints.map((h) => (
                  <option key={h.name} value={h.name} />
                ))}
              </datalist>
            </label>
            <button
              type="button"
              disabled={busy || !renameFrom}
              onClick={runRename}
              className="rounded-lg border border-amber-500/60 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/20 disabled:opacity-40"
            >
              一括置換
            </button>
          </div>
        </section>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-700/80">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">日付</th>
              <th className="px-3 py-2 font-medium">アーティスト</th>
              <th className="px-3 py-2 font-medium">推し</th>
              <th className="px-3 py-2 font-medium">タイトル</th>
              <th className="px-3 py-2 font-medium">会場</th>
              <th className="px-3 py-2 font-medium">金額</th>
              <th className="px-3 py-2 font-medium">ジャンル</th>
              <th className="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/40">
            {pending && !data ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                  読み込み中…
                </td>
              </tr>
            ) : null}
            {data?.rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                  該当なし
                </td>
              </tr>
            ) : null}
            {data?.rows.map((row) => {
              const oshi = row.oshiId ? oshiById.get(row.oshiId) : undefined;
              return (
              <tr key={row.id} className="hover:bg-slate-900/80">
                <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                  {row.performanceDate ?? "—"}
                </td>
                <td className="max-w-[10rem] truncate px-3 py-2 text-slate-100">
                  {row.artist ?? (
                    <span className="text-amber-300/90">不明</span>
                  )}
                </td>
                <td className="max-w-[8rem] truncate px-3 py-2 text-slate-200">
                  {oshi ? (
                    <span className="inline-flex max-w-full items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: oshi.themeColor }}
                        aria-hidden
                      />
                      <span className="truncate">{oshi.label}</span>
                    </span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
                <td className="max-w-[16rem] truncate px-3 py-2 font-medium text-white">
                  {row.title}
                </td>
                <td className="max-w-[12rem] truncate px-3 py-2 text-slate-300">
                  {row.venue ?? "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-300">
                  {row.price == null ? "—" : `¥${row.price.toLocaleString("ja-JP")}`}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                  {GENRE_LABEL[row.genre]}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditRow(row);
                        setForm(rowToForm(row));
                        setCreating(false);
                        setScanImageHash(null);
                        setParseNote(null);
                      }}
                      className="text-sky-300 hover:underline"
                    >
                      {data.canEdit ? "編集" : "詳細"}
                    </button>
                    {data.canEdit ? (
                      <button
                        type="button"
                        onClick={() => removeRow(row)}
                        className="text-rose-300 hover:underline"
                      >
                        削除
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data ? (
        <p className="text-xs text-slate-500">
          表示 {data.rows.length} 件
          {pending ? "（更新中…）" : ""}
        </p>
      ) : null}

      {(editRow || creating) && data ? (
        <EditDialog
          title={creating ? "過去データを追加" : data.canEdit ? "編集" : "詳細"}
          form={form}
          setForm={setForm}
          oshiList={data.oshiList}
          canEdit={!!data.canEdit && (creating || !!editRow)}
          readOnly={!data.canEdit}
          busy={busy}
          parsing={parsing}
          parseNote={parseNote}
          showTicketScan={!!data.canEdit && (creating || !!editRow)}
          fileInputRef={fileInputRef}
          onParseTicket={onParseTicket}
          onClose={closeDialog}
          onSave={creating ? saveCreate : saveEdit}
          extra={
            editRow ? (
              <p className="text-xs text-slate-500">
                由来: {editRow.sourceType}
                {editRow.sourceImageIndex
                  ? ` / ${editRow.sourceImageIndex}`
                  : ""}
                {editRow.sourceFile ? ` / ${editRow.sourceFile}` : ""}
              </p>
            ) : null
          }
        />
      ) : null}

      <p className="text-sm">
        <Link href="/analytics/past" className="text-sky-300 hover:underline">
          ← 過去データの分析へ
        </Link>
      </p>
    </div>
  );
}

function EditDialog({
  title,
  form,
  setForm,
  oshiList,
  canEdit,
  readOnly,
  busy,
  parsing,
  parseNote,
  showTicketScan,
  fileInputRef,
  onParseTicket,
  onClose,
  onSave,
  extra,
}: {
  title: string;
  form: FormState;
  setForm: (f: FormState) => void;
  oshiList: Oshi[];
  canEdit: boolean;
  readOnly: boolean;
  busy: boolean;
  parsing?: boolean;
  parseNote?: string | null;
  showTicketScan?: boolean;
  fileInputRef?: RefObject<HTMLInputElement>;
  onParseTicket?: (file: File) => void;
  onClose: () => void;
  onSave: () => void;
  extra?: ReactNode;
}) {
  const disabled = readOnly || busy || parsing;

  function field(
    key: keyof FormState,
    label: string,
    opts?: { type?: string; textarea?: boolean }
  ) {
    if (opts?.textarea) {
      return (
        <label className="block text-xs text-slate-400">
          {label}
          <textarea
            value={form[key]}
            disabled={disabled}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 disabled:opacity-70"
          />
        </label>
      );
    }
    return (
      <label className="block text-xs text-slate-400">
        {label}
        <input
          type={opts?.type ?? "text"}
          value={form[key]}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 disabled:opacity-70"
        />
      </label>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-400 hover:text-white"
          >
            閉じる
          </button>
        </div>
        {extra ? <div className="mt-2">{extra}</div> : null}
        {showTicketScan && fileInputRef && onParseTicket ? (
          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/60 p-4">
            <p className="text-sm text-slate-300">
              半券・電子チケットの画像から各項目を自動入力できます（FC・プレイガイド問わず）。画像は保存しません。
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onParseTicket(file);
                }}
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-sky-600/60 bg-sky-950/40 px-4 py-2 text-sm font-medium text-sky-200 hover:bg-sky-900/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {parsing ? "読み取り中…" : "券面から読み取り"}
              </button>
              {parseNote ? (
                <p className="text-sm text-slate-400">{parseNote}</p>
              ) : (
                <p className="text-sm text-slate-500">
                  読み取り後もフィールドは自由に編集できます。
                </p>
              )}
            </div>
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {field("performanceDate", "日付", { type: "date" })}
          {field("startTime", "開演", { type: "time" })}
          {field("artist", "アーティスト")}
          <label className="block text-xs text-slate-400">
            推し
            <select
              value={form.oshiId}
              disabled={disabled}
              onChange={(e) => setForm({ ...form, oshiId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 disabled:opacity-70"
            >
              <option value="">（未設定）</option>
              {oshiList.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {field("title", "タイトル")}
          {field("venue", "会場")}
          {field("city", "都市")}
          {field("price", "金額（円）")}
          <label className="block text-xs text-slate-400">
            ジャンル
            <select
              value={form.genre}
              disabled={disabled}
              onChange={(e) =>
                setForm({ ...form, genre: e.target.value as PastGenre })
              }
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 disabled:opacity-70"
            >
              <option value="concert">コンサート</option>
              <option value="stage">演劇・ミュージカル</option>
              <option value="other">その他</option>
            </select>
          </label>
          {field("seatInfo", "座席")}
          {field("topic", "Topic")}
          <div className="sm:col-span-2">{field("notes", "備考", { textarea: true })}</div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200"
          >
            閉じる
          </button>
          {canEdit && !readOnly ? (
            <button
              type="button"
              disabled={busy || parsing || !form.title.trim()}
              onClick={onSave}
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-40"
            >
              {busy ? "保存中…" : "保存"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
