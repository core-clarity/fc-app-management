/** 未指定時に使うパレット（名義・推し・アーティスト共通） */
export const FALLBACK_PALETTE = [
  "#F97316",
  "#EC4899",
  "#3B82F6",
  "#22C55E",
  "#A855F7",
  "#EAB308",
  "#14B8A6",
  "#F43F5E",
  "#8B5CF6",
  "#06B6D4",
  "#84CC16",
  "#FB7185",
  "#38BDF8",
  "#FBBF24",
  "#C084FC",
] as const;

export const SPECIAL_THEME_COLORS = {
  unknown: "#64748B",
  others: "#475569",
} as const;

/** #RRGGBB を正規化。不正なら null */
export function normalizeHexColor(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  const m = /^#?([0-9A-Fa-f]{6})$/.exec(trimmed);
  if (!m) return null;
  return `#${m[1].toUpperCase()}`;
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && normalizeHexColor(value) != null;
}

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** salt から安定した自動色を返す */
export function autoThemeColor(salt: string): string {
  const idx = hashString(salt) % FALLBACK_PALETTE.length;
  return FALLBACK_PALETTE[idx];
}

/**
 * 明示色があればそれを使い、なければ salt から自動色。
 * 「不明」「Others」は固定グレー。
 */
export function resolveThemeColor(
  explicit: string | null | undefined,
  salt: string
): string {
  if (salt === "不明") return SPECIAL_THEME_COLORS.unknown;
  if (salt === "Others") return SPECIAL_THEME_COLORS.others;
  const normalized = normalizeHexColor(explicit);
  if (normalized) return normalized;
  return autoThemeColor(salt);
}

/**
 * シリーズ（円グラフのスライス等）向け色割当。
 * 明示色を優先し、未指定は既使用色とぶつからないようパレットから順に割当。
 */
export function assignSeriesColors(
  names: string[],
  explicitFor: (name: string) => string | null | undefined
): Map<string, string> {
  const result = new Map<string, string>();
  const used = new Set<string>();

  for (const name of names) {
    if (name === "不明") {
      result.set(name, SPECIAL_THEME_COLORS.unknown);
      used.add(SPECIAL_THEME_COLORS.unknown);
      continue;
    }
    if (name === "Others") {
      result.set(name, SPECIAL_THEME_COLORS.others);
      used.add(SPECIAL_THEME_COLORS.others);
      continue;
    }
    const explicit = normalizeHexColor(explicitFor(name));
    if (explicit) {
      result.set(name, explicit);
      used.add(explicit);
    }
  }

  let paletteIdx = 0;
  const nextUnusedPalette = (): string => {
    while (paletteIdx < FALLBACK_PALETTE.length) {
      const c = FALLBACK_PALETTE[paletteIdx];
      paletteIdx += 1;
      if (!used.has(c)) return c;
    }
    // パレット枯渇時はインデックス循環で未使用を探す
    for (let i = 0; i < FALLBACK_PALETTE.length; i += 1) {
      const c = FALLBACK_PALETTE[i];
      if (!used.has(c)) return c;
    }
    return FALLBACK_PALETTE[names.length % FALLBACK_PALETTE.length];
  };

  for (const name of names) {
    if (result.has(name)) continue;
    const color = nextUnusedPalette();
    result.set(name, color);
    used.add(color);
  }

  return result;
}
