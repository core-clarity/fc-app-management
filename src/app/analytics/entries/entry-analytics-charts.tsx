"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  EntryAnalyticsPayload,
  MemberEntryAnalytics,
} from "@/lib/entry-analytics";

type Props = {
  data: EntryAnalyticsPayload;
};

function formatPercent(value: number | null): string {
  if (value == null) return "—";
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

function chartMemberColor(member: MemberEntryAnalytics): string {
  const color = member.themeColor?.trim();
  if (!color || color.toLowerCase() === "#ffffff") return "#7193bf";
  return color;
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-slate-500">
      {message}
    </div>
  );
}

export function EntryAnalyticsCharts({ data }: Props) {
  const chartData = data.members.map((member) => ({
    ...member,
    winRateValue: member.winRate,
  }));

  return (
    <div className="space-y-5">
      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <Panel
          title="名義別 エントリ数"
          description="第2希望以降を含む場合は、公演ごとのエントリとして集計"
        >
          {chartData.length === 0 ? (
            <EmptyChart message="名義データがありません" />
          ) : (
            <div className="h-72 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 4, right: 12, left: 0, bottom: 4 }}
                >
                  <CartesianGrid
                    horizontal={false}
                    stroke="#e2e8f0"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    stroke="#64748b"
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={68}
                    interval={0}
                    stroke="#64748b"
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: "#f1f5f9" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const member = payload[0].payload as MemberEntryAnalytics;
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-lg">
                          <p className="font-semibold text-slate-900">
                            {member.label}
                            {member.isUnassigned ? "（未割当）" : ""}
                          </p>
                          <p className="mt-1">
                            {member.total.toLocaleString("ja-JP")} 件
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="total"
                    name="エントリ数"
                    radius={[0, 4, 4, 0]}
                    isAnimationActive
                    animationDuration={700}
                  >
                    {chartData.map((member) => (
                      <Cell
                        key={member.id}
                        fill={chartMemberColor(member)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel
          title="名義別 勝率"
          description="当選 ÷（当選＋落選）。未確定は分母から除外"
        >
          {chartData.length === 0 ? (
            <EmptyChart message="名義データがありません" />
          ) : (
            <div className="h-72 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 4, right: 12, left: 0, bottom: 4 }}
                >
                  <CartesianGrid
                    horizontal={false}
                    stroke="#e2e8f0"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                    stroke="#64748b"
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={68}
                    interval={0}
                    stroke="#64748b"
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: "#f1f5f9" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const member = payload[0].payload as MemberEntryAnalytics;
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-lg">
                          <p className="font-semibold text-slate-900">
                            {member.label}
                            {member.isUnassigned ? "（未割当）" : ""}
                          </p>
                          <p className="mt-1 text-emerald-700">
                            勝率 {formatPercent(member.winRate)}
                          </p>
                          <p className="mt-0.5 text-slate-500">
                            当選 {member.won} / 落選 {member.lost} / 確定{" "}
                            {member.resolved} 件
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="winRateValue"
                    name="勝率"
                    fill="#5383c3"
                    radius={[0, 4, 4, 0]}
                    isAnimationActive
                    animationDuration={800}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="名義別の結果内訳">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="border-b border-slate-200 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">名義</th>
                <th className="px-3 py-2 text-right font-medium">総数</th>
                <th className="px-3 py-2 text-right font-medium">当選</th>
                <th className="px-3 py-2 text-right font-medium">落選</th>
                <th className="px-3 py-2 text-right font-medium">未確定</th>
                <th className="px-3 py-2 text-right font-medium">勝率</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.members.map((member) => (
                <tr key={member.id}>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-800">
                    {member.label}
                    {member.isUnassigned ? (
                      <span className="ml-1.5 text-xs font-normal text-amber-700">
                        未割当
                      </span>
                    ) : null}
                    <span className="ml-1.5 text-xs font-normal text-slate-500">
                      {member.name}
                    </span>
                  </th>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                    {member.total}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">
                    {member.won}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                    {member.lost}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">
                    {member.pending}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-800">
                    {formatPercent(member.winRate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
