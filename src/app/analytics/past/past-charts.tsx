"use client";

import type { ReactNode } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import type { PastAnalyticsPayload, YearStack } from "@/lib/past-analytics";

type Props = {
  data: PastAnalyticsPayload;
};

type Slice = { name: string; value: number; color: string };

function yen(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}

function formatPct(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Recharts Legend はデフォルトで名前順。系列順（比重順）を維持する */
function legendOrder(keys: string[]) {
  return (item: { dataKey?: unknown; value?: unknown }) => {
    const name = String(item.dataKey ?? item.value ?? "");
    const i = keys.indexOf(name);
    return i === -1 ? 999 : i;
  };
}

function Panel({
  title,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-slate-700/80 bg-slate-900/70 p-4 sm:p-5 ${className}`}
    >
      <h2 className="text-sm font-semibold tracking-wide text-slate-200 sm:text-base">
        {title}
      </h2>
      <div className={`mt-3 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

function DarkTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: unknown;
  label?: unknown;
}) {
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;
  const visible = payload.filter(
    (p): p is { name?: string; value: number; color?: string } =>
      typeof p === "object" &&
      p != null &&
      typeof (p as { value?: unknown }).value === "number" &&
      (p as { value: number }).value > 0
  );
  if (visible.length === 0) return null;
  return (
    <div className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-xs text-slate-100 shadow-lg">
      {typeof label === "string" || typeof label === "number" ? (
        <p className="mb-1 font-medium text-slate-300">{String(label)}</p>
      ) : null}
      {visible.map((p, i) => (
        <p key={i} style={{ color: p.color ?? "#e2e8f0" }}>
          {p.name}: {p.value.toLocaleString("ja-JP")}
        </p>
      ))}
    </div>
  );
}

function StylishDonut({
  slices,
  centerValue,
  centerUnit,
  heightClass = "h-80",
  topRatios,
}: {
  slices: Slice[];
  centerValue: number;
  centerUnit: string;
  heightClass?: string;
  topRatios?: Slice[];
}) {
  const total = slices.reduce((s, d) => s + d.value, 0) || 1;

  return (
    <div
      className={`flex w-full flex-col gap-4 sm:flex-row sm:items-center ${heightClass}`}
    >
      <div className="mx-auto w-full max-w-[300px] shrink-0">
        <div className="relative mx-auto aspect-square w-full">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-[16%] rounded-full bg-[#071428]"
          />
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
            <p className="text-5xl font-bold tabular-nums tracking-tight text-white sm:text-6xl">
              {centerValue.toLocaleString("ja-JP")}
            </p>
            <p className="mt-1 text-sm font-medium tracking-wide text-slate-400">
              {centerUnit}
            </p>
          </div>

          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[{ value: 1 }]}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius="74%"
                outerRadius="76%"
                fill="transparent"
                stroke="#1e4a6e"
                strokeWidth={1.5}
                isAnimationActive={false}
                legendType="none"
                tooltipType="none"
              />
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="78%"
                outerRadius="96%"
                paddingAngle={1.2}
                stroke="#020617"
                strokeWidth={2}
                isAnimationActive
                animationDuration={1000}
                animationBegin={80}
              >
                {slices.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const p = payload[0];
                  const value = Number(p.value ?? 0);
                  const pct = Math.round((value / total) * 1000) / 10;
                  const color =
                    (p.payload as Slice | undefined)?.color ?? "#e2e8f0";
                  return (
                    <div className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-xs text-slate-100 shadow-lg">
                      <p className="font-medium" style={{ color }}>
                        {p.name}
                      </p>
                      <p className="mt-1 text-slate-300">
                        {value.toLocaleString("ja-JP")} 回（{pct}%）
                      </p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {topRatios && topRatios.length > 0 ? (
          <div className="mt-3 flex items-end justify-center gap-4">
            {topRatios.map((s, i) => {
              const pct = (s.value / total) * 100;
              const size =
                i === 0
                  ? "text-3xl sm:text-4xl"
                  : i === 1
                    ? "text-xl sm:text-2xl"
                    : "text-base sm:text-lg";
              return (
                <div key={s.name} className="min-w-0 max-w-[6rem] text-center">
                  <p
                    className={`${size} font-bold tabular-nums leading-none tracking-tight`}
                    style={{ color: s.color }}
                  >
                    {formatPct(pct)}
                    <span className="ml-0.5 text-[0.55em] font-semibold">%</span>
                  </p>
                  <p className="mt-1 truncate text-[10px] text-slate-400">
                    {s.name}
                  </p>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <ul className="min-w-0 flex-1 space-y-1.5 text-xs sm:text-sm">
        {slices.map((s) => {
          const pct = Math.round((s.value / total) * 1000) / 10;
          return (
            <li key={s.name} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-slate-200">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="truncate">{s.name}</span>
              </span>
              <span className="shrink-0 tabular-nums text-slate-400">
                {s.value}（{pct}%）
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function YearStackBars({
  stack,
  heightClass = "h-80",
}: {
  stack: YearStack;
  heightClass?: string;
}) {
  if (stack.rows.length === 0) {
    return <Empty message="日付付きのデータがまだありません" />;
  }

  return (
    <div className={`w-full ${heightClass}`}>
      <ResponsiveContainer>
        <BarChart data={stack.rows} margin={{ bottom: 4, left: 0, right: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="year"
            stroke="#94a3b8"
            tick={{ fontSize: 9 }}
            angle={-60}
            textAnchor="end"
            height={60}
            interval="preserveStartEnd"
            minTickGap={8}
            tickFormatter={(v) => String(v).slice(2)}
          />
          <YAxis
            stroke="#94a3b8"
            tick={{ fontSize: 11 }}
            allowDecimals={false}
            width={28}
            label={{
              value: "回",
              angle: -90,
              position: "insideLeft",
              fill: "#94a3b8",
              fontSize: 11,
            }}
          />
          <Tooltip
            content={({ active, payload, label }) => (
              <DarkTooltip
                active={active}
                payload={payload}
                label={label != null ? `${label}年` : undefined}
              />
            )}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "#cbd5e1" }}
            itemSorter={legendOrder(stack.keys)}
          />
          {stack.keys.map((key) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="a"
              fill={stack.colors[key]}
              isAnimationActive
              animationDuration={900}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PastCharts({ data }: Props) {
  const artistPieData = data.artistPie.map((d) => ({
    name: d.name,
    value: d.count,
    color: d.color,
  }));

  const oshiPieData = data.oshiPie.map((d) => ({
    name: d.name,
    value: d.count,
    color: d.color,
  }));

  const oshiTop3 = oshiPieData.slice(0, 3);

  const cumulativeChart = data.cumulativeSpend.map((p) => ({
    date: p.date,
    label: p.label,
    万円: Math.round((p.totalYen / 10000) * 10) / 10,
    totalYen: p.totalYen,
  }));

  const avgPriceChart = data.avgPriceByYear.map((p) => ({
    year: p.year,
    avgYen: p.avgYen,
    count: p.count,
  }));

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="累計参加公演数（アーティスト別）">
          {artistPieData.length === 0 ? (
            <Empty />
          ) : (
            <StylishDonut
              slices={artistPieData}
              centerValue={data.totalShows}
              centerUnit="参加公演"
            />
          )}
        </Panel>

        <Panel title="年別 参加回数（アーティスト積み上げ）">
          <YearStackBars stack={data.artistYearStack} />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="累計参加公演数（推し別）">
          {oshiPieData.length === 0 ? (
            <Empty message="推しが設定された公演がまだありません" />
          ) : (
            <StylishDonut
              slices={oshiPieData}
              centerValue={data.oshiAssignedCount}
              centerUnit="設定済み"
              heightClass="min-h-80 sm:min-h-[22rem]"
              topRatios={oshiTop3}
            />
          )}
        </Panel>

        <Panel title="年別 参加回数（推し別積み上げ）">
          {data.oshiYearStack.rows.length === 0 ? (
            <Empty message="推しが設定された日付付きデータがまだありません" />
          ) : (
            <YearStackBars stack={data.oshiYearStack} />
          )}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Panel title="推し別 年別の回数推移">
            {data.oshiYearLine.rows.length === 0 ? (
              <Empty message="推しが設定された日付付きデータがまだありません" />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer>
                  <LineChart data={data.oshiYearLine.rows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="year"
                      stroke="#94a3b8"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => String(v).slice(2)}
                      minTickGap={12}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fontSize: 11 }}
                      allowDecimals={false}
                      width={28}
                      label={{
                        value: "回",
                        angle: -90,
                        position: "insideLeft",
                        fill: "#94a3b8",
                        fontSize: 11,
                      }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => (
                        <DarkTooltip
                          active={active}
                          payload={payload}
                          label={label != null ? `${label}年` : undefined}
                        />
                      )}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#cbd5e1" }} />
                    {data.oshiYearLine.keys.map((key) => (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stroke={data.oshiYearLine.colors[key]}
                        strokeWidth={2.2}
                        dot={false}
                        activeDot={{ r: 4 }}
                        isAnimationActive
                        animationDuration={1000}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>

          <Panel title="累積支出金額の推移">
            {cumulativeChart.length === 0 ? (
              <Empty message="金額付きのデータがまだありません" />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer>
                  <LineChart data={cumulativeChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="label"
                      stroke="#94a3b8"
                      tick={{ fontSize: 11 }}
                      minTickGap={28}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fontSize: 12 }}
                      label={{
                        value: "万円",
                        angle: -90,
                        position: "insideLeft",
                        fill: "#94a3b8",
                        fontSize: 11,
                      }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const p = payload[0].payload as {
                          date: string;
                          totalYen: number;
                        };
                        return (
                          <div className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-xs text-slate-100">
                            <p>{p.date}</p>
                            <p className="mt-1 text-sky-300">{yen(p.totalYen)}</p>
                          </div>
                        );
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="万円"
                      stroke="#38BDF8"
                      strokeWidth={2.5}
                      dot={false}
                      isAnimationActive
                      animationDuration={1100}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>

          <Panel title="チケット平均単価の変遷（年別平均）">
            {avgPriceChart.length === 0 ? (
              <Empty message="金額付きのデータがまだありません" />
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer>
                  <LineChart data={avgPriceChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="year" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const p = payload[0].payload as {
                          year: string;
                          avgYen: number;
                          count: number;
                        };
                        return (
                          <div className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-xs text-slate-100">
                            <p>{p.year}</p>
                            <p className="mt-1 text-emerald-300">
                              平均 {yen(p.avgYen)}（{p.count}件）
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgYen"
                      name="平均単価"
                      stroke="#34D399"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#34D399" }}
                      isAnimationActive
                      animationDuration={1000}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>
        </div>

        <Panel
          title="リピート公演 TOP 40"
          className="flex h-full min-h-[28rem] flex-col"
          bodyClassName="flex min-h-0 flex-1 flex-col"
        >
          {data.repeatTop40.length === 0 ? (
            <Empty />
          ) : (
            <ol className="flex flex-1 flex-col justify-between gap-0.5 text-[11px] leading-snug sm:text-xs">
              {data.repeatTop40.map((t) => (
                <li
                  key={`${t.rank}-${t.title}`}
                  className="flex items-baseline justify-between gap-2 py-0.5"
                >
                  <span className="min-w-0 truncate text-slate-200">
                    <span className="mr-1.5 font-mono text-[10px] text-slate-500">
                      {String(t.rank).padStart(2, "0")}.
                    </span>
                    {t.title}
                  </span>
                  <span className="shrink-0 tabular-nums text-sky-300">
                    {t.count}回
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="年別ジャンル比率">
          {data.genreYearStack.rows.length === 0 ? (
            <Empty message="日付付きのデータがまだありません" />
          ) : (
            <div className="h-80 w-full">
              <ResponsiveContainer>
                <BarChart
                  data={data.genreYearStack.rows}
                  stackOffset="expand"
                  margin={{ bottom: 4, left: 0, right: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="year"
                    stroke="#94a3b8"
                    tick={{ fontSize: 9 }}
                    angle={-60}
                    textAnchor="end"
                    height={60}
                    interval="preserveStartEnd"
                    minTickGap={8}
                    tickFormatter={(v) => String(v).slice(2)}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fontSize: 11 }}
                    width={36}
                    tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`}
                    domain={[0, 1]}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const total = payload.reduce(
                        (sum, p) =>
                          sum + (typeof p.value === "number" ? p.value : 0),
                        0
                      );
                      if (total <= 0) return null;
                      return (
                        <div className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-xs text-slate-100 shadow-lg">
                          <p className="mb-1 font-medium text-slate-300">
                            {label}年
                          </p>
                          {payload
                            .filter(
                              (p) => typeof p.value === "number" && p.value > 0
                            )
                            .map((p, i) => {
                              const value = Number(p.value);
                              const pct = formatPct((value / total) * 100);
                              return (
                                <p key={i} style={{ color: p.color ?? "#e2e8f0" }}>
                                  {p.name}: {value.toLocaleString("ja-JP")} 回（
                                  {pct}%）
                                </p>
                              );
                            })}
                        </div>
                      );
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: "#cbd5e1" }}
                    itemSorter={legendOrder(data.genreYearStack.keys)}
                  />
                  {data.genreYearStack.keys.map((key) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      stackId="g"
                      fill={data.genreYearStack.colors[key]}
                      isAnimationActive
                      animationDuration={900}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="会場別 来場回数 TOP 10">
          {data.venueTop10.length === 0 ? (
            <Empty />
          ) : (
            <ol className="divide-y divide-slate-800 text-sm">
              {data.venueTop10.map((v) => (
                <li
                  key={v.venue}
                  className="flex items-baseline justify-between gap-3 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="mr-2 font-mono text-xs text-slate-500">
                      {String(v.rank).padStart(2, "0")}.
                    </span>
                    <span className="text-slate-100">{v.venue}</span>
                  </span>
                  <span className="shrink-0 font-medium text-sky-300">
                    {v.count}回
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Empty({ message = "データがありません" }: { message?: string }) {
  return (
    <p className="py-10 text-center text-sm text-slate-500">{message}</p>
  );
}
