import fs from "fs";

const data = JSON.parse(
  fs.readFileSync("過去半券_焼込済/1.json", "utf8")
) as Array<Record<string, unknown>>;

const n = data.length;
const nullArtist = data.filter((d) => !d.artist).length;
const nullPrice = data.filter((d) => d.price == null).length;
const nullVenue = data.filter((d) => !d.venue).length;
const genres: Record<string, number> = {};
const cities: Record<string, number> = {};
const years: Record<string, number> = {};
for (const d of data) {
  const g = String(d.genre ?? "null");
  genres[g] = (genres[g] || 0) + 1;
  const c = String(d.city ?? "null");
  cities[c] = (cities[c] || 0) + 1;
  const y = String(d.performanceDate ?? "").slice(0, 4);
  years[y] = (years[y] || 0) + 1;
}
const prices = data
  .map((d) => d.price)
  .filter((p): p is number => typeof p === "number");
const sum = prices.reduce((a, b) => a + b, 0);
const sampleArtists = Array.from(
  new Set(data.map((d) => d.artist).filter(Boolean))
).slice(0, 25);




console.log(
  JSON.stringify(
    {
      count: n,
      nullArtist,
      nullPrice,
      nullVenue,
      genres,
      cities,
      yearRange: Object.keys(years).sort(),
      yearCounts: years,
      priceKnown: prices.length,
      priceSum: sum,
      priceAvg: Math.round(sum / prices.length),
      sampleArtists,
    },
    null,
    2
  )
);
