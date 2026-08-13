export type PastGenre = "concert" | "stage" | "other";

export type PastAttendanceRow = {
  artist: string | null;
  venue: string | null;
  performanceDate: string | null;
  price: number | null;
  genre: PastGenre;
  oshiId: string | null;
  title: string;
};

export type OshiRef = {
  id: string;
  label: string;
  themeColor: string;
};

export type NamedCount = {
  name: string;
  count: number;
  color: string;
};

export type CumulativePoint = {
  date: string;
  totalYen: number;
  label: string;
};

export type YearAvgPrice = {
  year: string;
  avgYen: number;
  count: number;
};

export type VenueRank = {
  rank: number;
  venue: string;
  count: number;
};

export type TitleRank = {
  rank: number;
  title: string;
  count: number;
};

export type YearStack = {
  years: string[];
  keys: string[];
  colors: Record<string, string>;
  rows: Array<Record<string, string | number>>;
};

export type PastAnalyticsPayload = {
  totalShows: number;
  knownPriceSum: number;
  artistNullCount: number;
  /** 券面 artist のユニーク数（空・不明は含めない） */
  artistVariantCount: number;
  /** 会場のユニーク数（空は含めない） */
  venueUniqueCount: number;
  /** 推しが付いている件数 */
  oshiAssignedCount: number;
  artistPie: NamedCount[];
  artistYearStack: YearStack;
  oshiPie: NamedCount[];
  oshiYearStack: YearStack;
  oshiYearLine: YearStack;
  cumulativeSpend: CumulativePoint[];
  avgPriceByYear: YearAvgPrice[];
  genreYearStack: YearStack;
  venueTop10: VenueRank[];
  repeatTop40: TitleRank[];
};

const FALLBACK_PALETTE = [
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
];

/** アーティスト（券面表記）専用色。推しマスタとは別（グループ名など） */
const ARTIST_THEME_COLORS: Record<string, string> = {
  V6: "#ffa500",
  PrincessPrincess: "#ff69b4",
  "PRINCESS PRINCESS": "#ff69b4",
  "20th Century": "#00ff00",
  "20thCentury": "#00ff00",
  "Coming Century": "#ffff00",
  ComingCentury: "#ffff00",
  "B&ZAI": "#E11D48",
  "B & ZAI": "#E11D48",
};

const GENRE_LABEL: Record<PastGenre, string> = {
  concert: "コンサート",
  stage: "演劇・ミュージカル",
  other: "その他",
};

const GENRE_COLOR: Record<PastGenre, string> = {
  concert: "#38BDF8",
  stage: "#F472B6",
  other: "#94A3B8",
};

const GENRE_ORDER: PastGenre[] = ["concert", "stage", "other"];

export function artistLabel(artist: string | null | undefined): string {
  const trimmed = artist?.trim();
  return trimmed ? trimmed : "不明";
}

export function venueLabel(venue: string | null | undefined): string {
  const trimmed = venue?.trim();
  return trimmed ? trimmed : "不明";
}

function yearOf(dateStr: string | null): string | null {
  if (!dateStr || dateStr.length < 4) return null;
  const year = Number(dateStr.slice(0, 4));
  if (!Number.isFinite(year) || year < 1900 || year > 2100) return null;
  return String(year);
}

function yearsInRange(minYear: number, maxYear: number): string[] {
  const years: string[] = [];
  for (let y = minYear; y <= maxYear; y += 1) years.push(String(y));
  return years;
}

function titleKey(title: string | null | undefined): string {
  return (title ?? "").trim().replace(/\s+/g, " ");
}

function colorForArtist(
  name: string,
  oshiColorByLabel: Map<string, string>,
  index: number
): string {
  if (name === "不明") return "#64748B";
  if (name === "Others") return "#475569";
  const fromArtist = ARTIST_THEME_COLORS[name];
  if (fromArtist) return fromArtist;
  const fromOshi = oshiColorByLabel.get(name);
  if (fromOshi) return fromOshi;
  return FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
}

function colorForOshi(
  name: string,
  oshiColorByLabel: Map<string, string>,
  index: number
): string {
  if (name === "不明") return "#64748B";
  if (name === "Others") return "#475569";
  return (
    oshiColorByLabel.get(name) ??
    FALLBACK_PALETTE[index % FALLBACK_PALETTE.length]
  );
}

function topNWithOthers(
  counts: Map<string, number>,
  n: number
): { names: string[]; counts: Map<string, number> } {
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, n);
  const rest = sorted.slice(n);
  const result = new Map<string, number>();
  for (const [name, count] of top) result.set(name, count);
  if (rest.length > 0) {
    result.set(
      "Others",
      rest.reduce((sum, [, c]) => sum + c, 0)
    );
  }
  return { names: Array.from(result.keys()), counts: result };
}

function emptyYearStack(): YearStack {
  return { years: [], keys: [], colors: {}, rows: [] };
}

function buildYearStack(
  years: string[],
  yearKeyCounts: Map<string, Map<string, number>>,
  totalCounts: Map<string, number>,
  topN: number,
  colorFor: (name: string, index: number) => string
): YearStack {
  if (years.length === 0 || totalCounts.size === 0) return emptyYearStack();

  const pack = topNWithOthers(totalCounts, topN);
  const keys = pack.names;
  const colors: Record<string, string> = {};
  keys.forEach((name, i) => {
    colors[name] = colorFor(name, i);
  });

  const rows: Array<Record<string, string | number>> = years.map((year) => {
    const m = yearKeyCounts.get(year) ?? new Map<string, number>();
    const row: Record<string, string | number> = { year };
    let others = 0;
    for (const [name, count] of Array.from(m.entries())) {
      if (keys.includes(name) && name !== "Others") {
        row[name] = count;
      } else if (name !== "Others") {
        others += count;
      }
    }
    if (keys.includes("Others")) row.Others = others;
    for (const name of keys) {
      if (row[name] == null) row[name] = 0;
    }
    return row;
  });

  return { years, keys, colors, rows };
}

export function buildPastAnalytics(
  rows: PastAttendanceRow[],
  oshiList: OshiRef[] = []
): PastAnalyticsPayload {
  const oshiById = new Map(oshiList.map((o) => [o.id, o] as const));
  const oshiColorByLabel = new Map(
    oshiList.map((o) => [o.label, o.themeColor] as const)
  );

  const artistCounts = new Map<string, number>();
  const venueCounts = new Map<string, number>();
  const titleCounts = new Map<string, number>();
  const oshiCounts = new Map<string, number>();
  const yearArtist = new Map<string, Map<string, number>>();
  const yearOshi = new Map<string, Map<string, number>>();
  const yearGenre = new Map<string, Map<string, number>>();

  let artistNullCount = 0;
  let knownPriceSum = 0;
  let oshiAssignedCount = 0;
  let minYear: number | null = null;
  let maxYear: number | null = null;

  const bumpYearMap = (
    store: Map<string, Map<string, number>>,
    year: string,
    key: string
  ) => {
    const m = store.get(year) ?? new Map<string, number>();
    m.set(key, (m.get(key) ?? 0) + 1);
    store.set(year, m);
  };

  for (const row of rows) {
    if (!row.artist?.trim()) artistNullCount += 1;
    const a = artistLabel(row.artist);
    artistCounts.set(a, (artistCounts.get(a) ?? 0) + 1);

    const venue = row.venue?.trim();
    if (venue) venueCounts.set(venue, (venueCounts.get(venue) ?? 0) + 1);

    const title = titleKey(row.title);
    if (title) titleCounts.set(title, (titleCounts.get(title) ?? 0) + 1);

    let oshiName: string | null = null;
    if (row.oshiId) {
      oshiAssignedCount += 1;
      const oshi = oshiById.get(row.oshiId);
      oshiName = oshi?.label ?? "不明";
      oshiCounts.set(oshiName, (oshiCounts.get(oshiName) ?? 0) + 1);
    }

    const year = yearOf(row.performanceDate);
    if (year) {
      const yNum = Number(year);
      if (minYear == null || yNum < minYear) minYear = yNum;
      if (maxYear == null || yNum > maxYear) maxYear = yNum;
      bumpYearMap(yearArtist, year, a);
      bumpYearMap(yearGenre, year, GENRE_LABEL[row.genre]);
      if (oshiName) bumpYearMap(yearOshi, year, oshiName);
    }

    if (typeof row.price === "number") knownPriceSum += row.price;
  }

  const years =
    minYear != null && maxYear != null ? yearsInRange(minYear, maxYear) : [];

  const piePack = topNWithOthers(artistCounts, 8);
  const artistPie: NamedCount[] = piePack.names.map((name, i) => ({
    name,
    count: piePack.counts.get(name) ?? 0,
    color: colorForArtist(name, oshiColorByLabel, i),
  }));

  const artistYearStack = buildYearStack(
    years,
    yearArtist,
    artistCounts,
    6,
    (name, i) => colorForArtist(name, oshiColorByLabel, i)
  );

  const oshiPiePack = topNWithOthers(oshiCounts, Math.max(oshiCounts.size, 1));
  const oshiPie: NamedCount[] = oshiPiePack.names.map((name, i) => ({
    name,
    count: oshiPiePack.counts.get(name) ?? 0,
    color: colorForOshi(name, oshiColorByLabel, i),
  }));

  const oshiTopN = oshiCounts.size <= 6 ? Math.max(oshiCounts.size, 1) : 6;
  const oshiYearStack = buildYearStack(
    years,
    yearOshi,
    oshiCounts,
    oshiTopN,
    (name, i) => colorForOshi(name, oshiColorByLabel, i)
  );
  const oshiYearLine = oshiYearStack;

  const priced = rows
    .filter(
      (r) =>
        r.performanceDate &&
        typeof r.price === "number" &&
        Number.isFinite(r.price)
    )
    .map((r) => ({
      date: r.performanceDate as string,
      price: r.price as number,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  let running = 0;
  const cumulativeSpend: CumulativePoint[] = priced.map((p) => {
    running += p.price;
    return {
      date: p.date,
      totalYen: running,
      label: p.date.slice(0, 7),
    };
  });

  const byYear = new Map<string, { sum: number; n: number }>();
  for (const p of priced) {
    const y = p.date.slice(0, 4);
    const cur = byYear.get(y) ?? { sum: 0, n: 0 };
    cur.sum += p.price;
    cur.n += 1;
    byYear.set(y, cur);
  }
  const avgPriceByYear: YearAvgPrice[] = Array.from(byYear.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, { sum, n }]) => ({
      year,
      avgYen: Math.round(sum / n),
      count: n,
    }));

  const genreTotals = new Map<string, number>();
  for (const g of GENRE_ORDER) {
    const n = rows.filter((r) => r.genre === g).length;
    if (n > 0) genreTotals.set(GENRE_LABEL[g], n);
  }

  const otherLabel = GENRE_LABEL.other;
  const genreKeys = Array.from(genreTotals.entries())
    .sort((a, b) => {
      const aOther = a[0] === otherLabel;
      const bOther = b[0] === otherLabel;
      if (aOther !== bOther) return aOther ? 1 : -1;
      return b[1] - a[1] || a[0].localeCompare(b[0]);
    })
    .map(([label]) => label);
  const genreRows = years
    .map((year) => {
      const m = yearGenre.get(year) ?? new Map<string, number>();
      const row: Record<string, string | number> = { year };
      let sum = 0;
      for (const label of genreKeys) {
        const n = m.get(label) ?? 0;
        row[label] = n;
        sum += n;
      }
      return { row, sum };
    })
    .filter((x) => x.sum > 0)
    .map((x) => x.row);

  const genreYearStack: YearStack = {
    years: genreRows.map((r) => String(r.year)),
    keys: genreKeys,
    colors: Object.fromEntries(
      GENRE_ORDER.map((g) => [GENRE_LABEL[g], GENRE_COLOR[g]] as const)
    ),
    rows: genreRows,
  };

  const venueTop10: VenueRank[] = Array.from(venueCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([venue, count], i) => ({
      rank: i + 1,
      venue,
      count,
    }));

  const repeatTop40: TitleRank[] = Array.from(titleCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 40)
    .map(([title, count], i) => ({
      rank: i + 1,
      title,
      count,
    }));

  const artistKnown = new Set(
    Array.from(artistCounts.keys()).filter((n) => n !== "不明")
  );

  return {
    totalShows: rows.length,
    knownPriceSum,
    artistNullCount,
    artistVariantCount: artistKnown.size,
    venueUniqueCount: venueCounts.size,
    oshiAssignedCount,
    artistPie,
    artistYearStack,
    oshiPie,
    oshiYearStack,
    oshiYearLine,
    cumulativeSpend,
    avgPriceByYear,
    genreYearStack,
    venueTop10,
    repeatTop40,
  };
}
