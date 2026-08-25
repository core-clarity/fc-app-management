"use client";

import { useCallback, useEffect, useState } from "react";
import { MemberSymbol } from "@/components/MemberSymbol";
import type { MemberSymbolEntry } from "@/lib/member-symbols";
import { autoThemeColor } from "@/lib/theme-colors";

type MemberRow = {
  id: string;
  label: string;
  name: string;
  symbol: string | null;
  themeColor: string | null;
  isActive: boolean;
};

type OshiRow = {
  id: string;
  label: string;
  themeColor: string;
  sortOrder: number;
  isActive: boolean;
};

type ArtistRow = {
  id: string;
  label: string;
  themeColor: string;
  sortOrder: number;
  isActive: boolean;
};

type AppearanceData = {
  symbolCatalog: MemberSymbolEntry[];
  members: MemberRow[];
  oshiList: OshiRow[];
  artistThemes: ArtistRow[];
  unregisteredArtists: string[];
};

function inputClassName() {
  return "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/25";
}

function ColorField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
}) {
  const safe = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : "#94A3B8";
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={safe}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-9 w-10 cursor-pointer rounded border border-slate-300 bg-white p-0.5 disabled:cursor-not-allowed"
        aria-label="色"
      />
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClassName()} w-[7.5rem] font-mono uppercase`}
        spellCheck={false}
      />
    </div>
  );
}

export function AppearanceSettingsClient() {
  const [data, setData] = useState<AppearanceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newArtistLabel, setNewArtistLabel] = useState("");
  const [newArtistColor, setNewArtistColor] = useState("#38BDF8");

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/settings/appearance");
    const json = (await res.json()) as AppearanceData & { error?: string };
    if (!res.ok) {
      setError(json.error ?? "読み込みに失敗しました。");
      return;
    }
    setData(json);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveMember(
    id: string,
    patch: { symbol?: string | null; themeColor?: string | null }
  ) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/members/${id}/appearance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = (await res.json()) as {
        member?: MemberRow;
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "名義の保存に失敗しました。");
        return;
      }
      if (json.member) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                members: prev.members.map((m) =>
                  m.id === id ? { ...m, ...json.member } : m
                ),
              }
            : prev
        );
        setMessage("名義を保存しました。");
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveOshi(id: string, themeColor: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/oshi-artists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeColor }),
      });
      const json = (await res.json()) as { oshi?: OshiRow; error?: string };
      if (!res.ok) {
        setError(json.error ?? "推しの保存に失敗しました。");
        return;
      }
      if (json.oshi) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                oshiList: prev.oshiList.map((o) =>
                  o.id === id ? { ...o, ...json.oshi } : o
                ),
              }
            : prev
        );
        setMessage("推しカラーを保存しました。");
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveArtist(
    id: string,
    patch: { label?: string; themeColor?: string }
  ) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/artist-themes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = (await res.json()) as {
        artistTheme?: ArtistRow;
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "アーティスト色の保存に失敗しました。");
        return;
      }
      if (json.artistTheme) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                artistThemes: prev.artistThemes.map((a) =>
                  a.id === id ? { ...a, ...json.artistTheme } : a
                ),
              }
            : prev
        );
        setMessage("アーティスト色を保存しました。");
      }
    } finally {
      setBusy(false);
    }
  }

  async function deleteArtist(id: string) {
    if (!confirm("このアーティスト色を削除しますか？")) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/artist-themes/${id}`, { method: "DELETE" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "削除に失敗しました。");
        return;
      }
      setData((prev) =>
        prev
          ? {
              ...prev,
              artistThemes: prev.artistThemes.filter((a) => a.id !== id),
            }
          : prev
      );
      setMessage("削除しました。");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function addArtist() {
    const label = newArtistLabel.trim();
    if (!label) {
      setError("ラベルを入力してください。");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/artist-themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          themeColor: newArtistColor,
        }),
      });
      const json = (await res.json()) as {
        artistTheme?: ArtistRow;
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "追加に失敗しました。");
        return;
      }
      setNewArtistLabel("");
      setMessage("アーティスト色を追加しました。");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function runAutoColors() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/appearance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auto-colors" }),
      });
      const json = (await res.json()) as {
        error?: string;
        membersUpdated?: number;
        oshiUpdated?: number;
      };
      if (!res.ok) {
        setError(json.error ?? "自動割当に失敗しました。");
        return;
      }
      setMessage(
        `自動割当完了: 名義 ${json.membersUpdated ?? 0} / 推し ${json.oshiUpdated ?? 0}`
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!data && !error) {
    return <p className="mt-8 text-slate-600">読み込み中…</p>;
  }

  if (!data) {
    return (
      <p className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error}
      </p>
    );
  }

  return (
    <div className="mt-8 space-y-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          名義・推しの未設定色のみ自動割当します。アーティストはチャート表示時にトップ枠内で自動色になります。
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void runAutoColors()}
          className="inline-flex rounded-lg border border-brand/40 bg-white px-4 py-2.5 text-sm font-semibold text-brand-dark transition hover:bg-brand-soft disabled:opacity-60"
        >
          名義・推しの未設定色を埋める
        </button>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}

      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-ink">名義（アイコン・色）</h2>
        <p className="mt-1 text-sm text-slate-500">
          申込一覧などで使う小さな記号です。
        </p>
        <ul className="mt-6 divide-y divide-slate-100">
          {data.members.map((m) => (
            <MemberEditor
              key={m.id}
              member={m}
              catalog={data.symbolCatalog}
              disabled={busy}
              onSave={(patch) => void saveMember(m.id, patch)}
            />
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-ink">推しカラー</h2>
        <p className="mt-1 text-sm text-slate-500">
          過去分析のチャート・ピン色です（色のみ編集）。
        </p>
        <ul className="mt-6 divide-y divide-slate-100">
          {data.oshiList.map((o) => (
            <OshiEditor
              key={o.id}
              oshi={o}
              disabled={busy}
              onSave={(color) => void saveOshi(o.id, color)}
            />
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-ink">アーティストカラー</h2>
        <p className="mt-1 text-sm text-slate-500">
          券面の artist 表記と完全一致するラベルに色を付けます。指定があるものは優先され、未指定でもチャートのトップ枠に入れば他色とぶつからないよう自動色になります（Others
          は固定グレー）。表記ゆれは別行で同じ色を登録してください。
        </p>

        {data.unregisteredArtists.length > 0 ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p className="font-medium">マスタ未登録の券面ラベル（参考）</p>
            <p className="mt-1 break-words text-slate-600">
              {data.unregisteredArtists.slice(0, 20).join("、")}
              {data.unregisteredArtists.length > 20
                ? ` …他 ${data.unregisteredArtists.length - 20} 件`
                : ""}
            </p>
            <p className="mt-2 text-slate-500">
              色を固定したい場合だけ下で追加してください。一括追加はしません。
            </p>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium text-slate-700">
            ラベル
            <input
              value={newArtistLabel}
              onChange={(e) => setNewArtistLabel(e.target.value)}
              className={inputClassName()}
              placeholder="例: 20th Century"
              disabled={busy}
            />
          </label>
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">色</p>
            <ColorField
              value={newArtistColor}
              onChange={setNewArtistColor}
              disabled={busy}
            />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void addArtist()}
            className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
          >
            追加
          </button>
        </div>

        <ul className="mt-6 divide-y divide-slate-100">
          {data.artistThemes.map((a) => (
            <ArtistEditor
              key={a.id}
              artist={a}
              disabled={busy}
              onSave={(patch) => void saveArtist(a.id, patch)}
              onDelete={() => void deleteArtist(a.id)}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

function MemberEditor({
  member,
  catalog,
  disabled,
  onSave,
}: {
  member: MemberRow;
  catalog: MemberSymbolEntry[];
  disabled: boolean;
  onSave: (patch: {
    symbol?: string | null;
    themeColor?: string | null;
  }) => void;
}) {
  const [symbol, setSymbol] = useState(member.symbol ?? "");
  const [color, setColor] = useState(
    member.themeColor ?? autoThemeColor(`member:${member.id}`)
  );

  useEffect(() => {
    setSymbol(member.symbol ?? "");
    setColor(member.themeColor ?? autoThemeColor(`member:${member.id}`));
  }, [member]);

  return (
    <li className="flex flex-col gap-4 py-5 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <MemberSymbol
          symbol={symbol || null}
          themeColor={color}
          size={32}
        />
        <div>
          <p className="font-semibold text-ink">
            {member.label}
            {!member.isActive ? (
              <span className="ml-2 text-xs font-normal text-slate-400">
                無効
              </span>
            ) : null}
          </p>
          <p className="text-sm text-slate-500">{member.name}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">アイコン</p>
        <div className="flex flex-wrap gap-2">
          {catalog.map((entry) => {
            const selected = symbol === entry.key;
            return (
              <button
                key={entry.key}
                type="button"
                disabled={disabled}
                onClick={() => setSymbol(entry.key)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                  selected
                    ? "border-brand bg-brand-soft text-brand-dark"
                    : "border-slate-200 bg-white text-slate-700 hover:border-brand/40"
                } disabled:opacity-60`}
              >
                <MemberSymbol
                  symbol={entry.key}
                  themeColor={color}
                  size={20}
                />
                {entry.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-sm font-medium text-slate-700">色</p>
          <ColorField value={color} onChange={setColor} disabled={disabled} />
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            onSave({
              symbol: symbol || null,
              themeColor: color,
            })
          }
          className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
        >
          保存
        </button>
      </div>
    </li>
  );
}

function OshiEditor({
  oshi,
  disabled,
  onSave,
}: {
  oshi: OshiRow;
  disabled: boolean;
  onSave: (color: string) => void;
}) {
  const [color, setColor] = useState(oshi.themeColor);

  useEffect(() => {
    setColor(oshi.themeColor);
  }, [oshi.themeColor]);

  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="h-4 w-4 shrink-0 rounded-full border border-slate-200"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">
            {oshi.label}
            {!oshi.isActive ? (
              <span className="ml-2 text-xs font-normal text-slate-400">
                無効
              </span>
            ) : null}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ColorField value={color} onChange={setColor} disabled={disabled} />
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSave(color)}
          className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
        >
          保存
        </button>
      </div>
    </li>
  );
}

function ArtistEditor({
  artist,
  disabled,
  onSave,
  onDelete,
}: {
  artist: ArtistRow;
  disabled: boolean;
  onSave: (patch: { label?: string; themeColor?: string }) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(artist.label);
  const [color, setColor] = useState(artist.themeColor);

  useEffect(() => {
    setLabel(artist.label);
    setColor(artist.themeColor);
  }, [artist]);

  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <span
          className="h-4 w-4 shrink-0 rounded-full border border-slate-200"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        {!artist.isActive ? (
          <span className="text-xs text-slate-400">無効</span>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium text-slate-700">
          ラベル
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={inputClassName()}
            disabled={disabled}
          />
        </label>
        <div>
          <p className="mb-1 text-sm font-medium text-slate-700">色</p>
          <ColorField value={color} onChange={setColor} disabled={disabled} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSave({ label, themeColor: color })}
          className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
        >
          保存
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onDelete}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          削除
        </button>
      </div>
    </li>
  );
}
