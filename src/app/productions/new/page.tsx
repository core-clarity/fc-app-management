"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";
import { PageBackNav } from "@/components/PageBackNav";
import type { ParsedSchedule, ParsedVenue } from "@/db/import";
import { dayLabelJa, dateToneClassName } from "@/lib/labels";

type CompanionTiming = "at_entry" | "before_show";
type IdVerification = "none" | "face_auth" | "other";

type FormVenue = {
  venue: string;
  city: string;
  performances: { date: string; time: string }[];
};

type FormState = {
  title: string;
  artist: string;
  venues: FormVenue[];
  companionTiming: CompanionTiming;
  idVerification: IdVerification;
  allowsGeneralCompanion: boolean;
};

const emptyForm = (): FormState => ({
  title: "",
  artist: "",
  venues: [],
  companionTiming: "at_entry",
  idVerification: "none",
  allowsGeneralCompanion: false,
});

function scheduleToForm(schedule: ParsedSchedule): FormState {
  const venues: FormVenue[] =
    schedule.venues?.length > 0
      ? schedule.venues.map((v: ParsedVenue) => ({
          venue: v.venue ?? "",
          city: v.city ?? "",
          performances:
            v.performances?.length > 0
              ? v.performances.map((p) => ({
                  date: p.date ?? "",
                  time: normalizeTimeForInput(p.time),
                }))
              : [{ date: "", time: "" }],
        }))
      : [{ venue: "", city: "", performances: [{ date: "", time: "" }] }];

  return {
    title: schedule.title ?? "",
    artist: schedule.artist ?? "",
    venues,
    companionTiming: "at_entry",
    idVerification: "none",
    allowsGeneralCompanion: false,
  };
}

function normalizeTimeForInput(time: string | null | undefined): string {
  if (!time) return "";
  const match = time.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return time.trim();
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function inputClassName() {
  return "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/25";
}

function labelClassName() {
  return "mb-1.5 block text-sm font-medium text-ink";
}

export default function NewProductionPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [hasParsed, setHasParsed] = useState(false);

  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  function revokePreviews(urls: string[]) {
    for (const url of urls) URL.revokeObjectURL(url);
  }

  function onFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    revokePreviews(previews);
    setFiles(selected);
    setPreviews(selected.map((file) => URL.createObjectURL(file)));
    setError(null);
    setSuccessId(null);
  }

  function clearFiles() {
    revokePreviews(previews);
    setFiles([]);
    setPreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onParse() {
    if (files.length === 0) {
      setError("画像を1枚以上選択してください。");
      return;
    }

    setParsing(true);
    setError(null);
    setSuccessId(null);

    try {
      const body = new FormData();
      for (const file of files) {
        body.append("images", file);
      }

      const res = await fetch("/api/productions/parse", {
        method: "POST",
        body,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "画像の読み取りに失敗しました。"
        );
        return;
      }

      setForm(scheduleToForm(data.schedule as ParsedSchedule));
      setHasParsed(true);
    } catch {
      setError("通信エラーが発生しました。もう一度お試しください。");
    } finally {
      setParsing(false);
    }
  }

  function updateVenue(index: number, patch: Partial<FormVenue>) {
    setForm((prev) => ({
      ...prev,
      venues: prev.venues.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    }));
  }

  function updatePerformance(
    venueIndex: number,
    perfIndex: number,
    patch: Partial<{ date: string; time: string }>
  ) {
    setForm((prev) => ({
      ...prev,
      venues: prev.venues.map((v, i) => {
        if (i !== venueIndex) return v;
        return {
          ...v,
          performances: v.performances.map((p, j) =>
            j === perfIndex ? { ...p, ...patch } : p
          ),
        };
      }),
    }));
  }

  function addVenue() {
    setForm((prev) => ({
      ...prev,
      venues: [
        ...prev.venues,
        { venue: "", city: "", performances: [{ date: "", time: "" }] },
      ],
    }));
  }

  function removeVenue(index: number) {
    setForm((prev) => ({
      ...prev,
      venues: prev.venues.filter((_, i) => i !== index),
    }));
  }

  function addPerformance(venueIndex: number) {
    setForm((prev) => ({
      ...prev,
      venues: prev.venues.map((v, i) =>
        i === venueIndex
          ? { ...v, performances: [...v.performances, { date: "", time: "" }] }
          : v
      ),
    }));
  }

  function removePerformance(venueIndex: number, perfIndex: number) {
    setForm((prev) => ({
      ...prev,
      venues: prev.venues.map((v, i) => {
        if (i !== venueIndex) return v;
        const next = v.performances.filter((_, j) => j !== perfIndex);
        return {
          ...v,
          performances: next.length > 0 ? next : [{ date: "", time: "" }],
        };
      }),
    }));
  }

  async function onSave() {
    if (saving || successId) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/productions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : "保存に失敗しました。"
        );
        return;
      }

      const id = data.production?.id as string | undefined;
      if (id) {
        setSuccessId(id);
        // 画面下部の成功表示へスクロール（変化が見えず再押下する事故防止）
        requestAnimationFrame(() => {
          document
            .getElementById("production-save-success")
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      }
    } catch {
      setError("通信エラーが発生しました。もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-surface px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="border-b border-slate-200 pb-6">
          <PageBackNav links={[{ href: "/", label: "ホームへ" }]} />
          <div className="mt-3">
            <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              公演登録
            </h1>
            <p className="mt-2 text-base text-slate-600">
              申込画面のスクショからスケジュールを読み取り、手修正して保存します。
            </p>
          </div>
        </header>

        {/* STEP 1: 画像アップロード */}
        <section className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-ink">1. 画像アップロード</h2>
          <p className="mt-1 text-sm text-slate-600">
            複数枚をまとめて選択できます（複数会場のスクショなど）。
          </p>

          <div className="mt-5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              onChange={onFilesChange}
              className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-dark"
            />
          </div>

          {previews.length > 0 ? (
            <div className="mt-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-ink">
                  選択中: {files.length} 枚
                </p>
                <button
                  type="button"
                  onClick={clearFiles}
                  className="text-sm font-medium text-slate-600 underline-offset-2 hover:text-ink hover:underline"
                >
                  クリア
                </button>
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {previews.map((src, i) => (
                  <li
                    key={src}
                    className="overflow-hidden rounded-lg border border-slate-200 bg-brand-soft/40"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={files[i]?.name ?? `preview-${i + 1}`}
                      className="h-32 w-full object-cover"
                    />
                    <p className="truncate px-2 py-1.5 text-xs text-slate-600">
                      {files[i]?.name}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <button
            type="button"
            onClick={onParse}
            disabled={parsing || files.length === 0}
            className="mt-6 w-full rounded-lg bg-brand px-4 py-3 text-base font-semibold text-white transition hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[12rem]"
          >
            {parsing ? "読み取り中…" : "読み取り開始"}
          </button>

          {parsing ? (
            <p className="mt-3 text-sm text-slate-600" role="status">
              Vision API で解析しています。画像枚数によっては数十秒かかることがあります。
            </p>
          ) : null}
        </section>

        {/* STEP 2–3: フォーム + ルール */}
        {hasParsed ? (
          <>
            <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8">
              <h2 className="text-lg font-semibold text-ink">
                2. 読み取り結果の確認・修正
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                黒・濃灰色セルは公演なしとして読み取ります。黄色・オレンジ等の強調色や、日付が省略された複数公演は必ず確認し、誤読がある場合は手で直してから保存してください。
              </p>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="title" className={labelClassName()}>
                    タイトル（ツアー名）
                  </label>
                  <input
                    id="title"
                    value={form.title}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                    className={inputClassName()}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="artist" className={labelClassName()}>
                    アーティスト名
                  </label>
                  <input
                    id="artist"
                    value={form.artist}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, artist: e.target.value }))
                    }
                    className={inputClassName()}
                  />
                </div>
              </div>

              <div className="mt-8 space-y-6">
                {form.venues.map((venue, vi) => (
                  <div
                    key={vi}
                    className="rounded-xl border border-slate-200 bg-surface/60 p-4 sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-base font-semibold text-ink">
                        会場 {vi + 1}
                      </h3>
                      {form.venues.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeVenue(vi)}
                          className="text-sm font-medium text-red-700 underline-offset-2 hover:underline"
                        >
                          削除
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor={`venue-${vi}`}
                          className={labelClassName()}
                        >
                          会場名
                        </label>
                        <input
                          id={`venue-${vi}`}
                          value={venue.venue}
                          onChange={(e) =>
                            updateVenue(vi, { venue: e.target.value })
                          }
                          className={inputClassName()}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`city-${vi}`}
                          className={labelClassName()}
                        >
                          都市名
                        </label>
                        <input
                          id={`city-${vi}`}
                          value={venue.city}
                          onChange={(e) =>
                            updateVenue(vi, { city: e.target.value })
                          }
                          className={inputClassName()}
                        />
                      </div>
                    </div>

                    <div className="mt-5 space-y-3">
                      <p className="text-sm font-medium text-ink">公演日程</p>
                      {venue.performances.map((perf, pi) => (
                        <div
                          key={pi}
                          className="flex flex-col gap-3 sm:flex-row sm:items-end"
                        >
                          <div className="flex-1">
                            <label
                              htmlFor={`date-${vi}-${pi}`}
                              className={labelClassName()}
                            >
                              日付
                            </label>
                            <input
                              id={`date-${vi}-${pi}`}
                              type="date"
                              value={perf.date}
                              onChange={(e) =>
                                updatePerformance(vi, pi, {
                                  date: e.target.value,
                                })
                              }
                              className={inputClassName()}
                            />
                            {perf.date && dayLabelJa(perf.date) ? (
                              <p
                                className={`mt-1.5 text-sm font-medium ${dateToneClassName(perf.date)}`}
                              >
                                （{dayLabelJa(perf.date)}）
                              </p>
                            ) : null}
                          </div>
                          <div className="flex-1">
                            <label
                              htmlFor={`time-${vi}-${pi}`}
                              className={labelClassName()}
                            >
                              開演時刻
                            </label>
                            <input
                              id={`time-${vi}-${pi}`}
                              type="time"
                              value={perf.time}
                              onChange={(e) =>
                                updatePerformance(vi, pi, {
                                  time: e.target.value,
                                })
                              }
                              className={inputClassName()}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removePerformance(vi, pi)}
                            className="mb-0.5 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-brand-soft"
                          >
                            削除
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addPerformance(vi)}
                        className="text-sm font-medium text-brand-dark underline-offset-2 hover:underline"
                      >
                        ＋ 公演を追加
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addVenue}
                className="mt-4 text-sm font-medium text-brand-dark underline-offset-2 hover:underline"
              >
                ＋ 会場を追加
              </button>
            </section>

            <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8">
              <h2 className="text-lg font-semibold text-ink">3. ルール設定</h2>
              <p className="mt-1 text-sm text-slate-600">
                同行者・本人確認の扱いを設定します。
              </p>

              <div className="mt-6 space-y-5">
                <div>
                  <label htmlFor="companionTiming" className={labelClassName()}>
                    同行者登録タイミング
                  </label>
                  <select
                    id="companionTiming"
                    value={form.companionTiming}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        companionTiming: e.target.value as CompanionTiming,
                      }))
                    }
                    className={inputClassName()}
                  >
                    <option value="at_entry">
                      申込時に登録・ソロ可（at_entry）
                    </option>
                    <option value="before_show">
                      公演前まででOK（before_show）
                    </option>
                  </select>
                </div>

                <div>
                  <label htmlFor="idVerification" className={labelClassName()}>
                    本人確認
                  </label>
                  <select
                    id="idVerification"
                    value={form.idVerification}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        idVerification: e.target.value as IdVerification,
                      }))
                    }
                    className={inputClassName()}
                  >
                    <option value="none">なし（none）</option>
                    <option value="face_auth">顔認証（face_auth）</option>
                    <option value="other">その他（other）</option>
                  </select>
                </div>

                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={form.allowsGeneralCompanion}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        allowsGeneralCompanion: e.target.checked,
                      }))
                    }
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
                  />
                  <span>
                    <span className="block text-sm font-medium text-ink">
                      一般メール同行を許可する
                    </span>
                    <span className="mt-0.5 block text-sm text-slate-600">
                      FC名義以外のメールアドレスを同行者に使える場合にチェックします。
                    </span>
                  </span>
                </label>
              </div>

              <button
                type="button"
                onClick={onSave}
                disabled={saving || !!successId}
                className="mt-8 w-full rounded-lg bg-brand px-4 py-3 text-base font-semibold text-white transition hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[12rem]"
              >
                {successId
                  ? "保存済み"
                  : saving
                    ? "保存中…"
                    : "保存する"}
              </button>
              {successId ? (
                <p className="mt-3 text-sm text-slate-600">
                  この内容での再保存はできません。別ツアーは「続けて登録」、内容の修正・削除は現状未実装です。
                </p>
              ) : null}
            </section>
          </>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </p>
        ) : null}

        {successId ? (
          <div
            id="production-save-success"
            role="status"
            className="mt-6 rounded-lg border border-brand/30 bg-brand-soft px-4 py-4 text-sm text-ink"
          >
            <p className="font-medium">公演を保存しました。</p>
            <p className="mt-1 text-slate-700">
              公演日程から日程ごとのエントリ追加ができます。登録済み公演の編集・削除画面はまだありません。
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => router.push(`/productions/${successId}`)}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
              >
                公演日程を見る
              </button>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-white"
              >
                ホームへ
              </button>
              <button
                type="button"
                onClick={() => {
                  setSuccessId(null);
                  setHasParsed(false);
                  setForm(emptyForm());
                  clearFiles();
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-white"
              >
                続けて登録（別ツアー）
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500">ID: {successId}</p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
