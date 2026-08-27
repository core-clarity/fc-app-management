"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  EntrySummaryList,
  type EntrySummaryData,
} from "@/components/EntrySummary";
import {
  dateToneClassName,
  formatDateWithDow,
  formatTimeDisplay,
} from "@/lib/labels";

export type SchedulePerformance = {
  id: string;
  venue: string;
  performanceDate: string;
  startTime: string;
  entries: EntrySummaryData[];
};

type ScheduleFilter = "all" | "applied" | "won";

const FILTER_OPTIONS: { value: ScheduleFilter; label: string }[] = [
  { value: "all", label: "ALL" },
  { value: "applied", label: "申込のみ" },
  { value: "won", label: "当選のみ" },
];

function matchesFilter(
  entries: EntrySummaryData[],
  filter: ScheduleFilter
): boolean {
  if (filter === "all") return true;
  if (filter === "applied") return entries.length > 0;
  return entries.some((e) => e.lotteryResult === "won");
}

export function ProductionScheduleList({
  venueGroups,
}: {
  venueGroups: [string, SchedulePerformance[]][];
}) {
  const [filter, setFilter] = useState<ScheduleFilter>("all");

  const { filteredGroups, visiblePerformanceCount } = useMemo(() => {
    let count = 0;
    const groups: [string, SchedulePerformance[]][] = [];

    for (const [venue, perfs] of venueGroups) {
      const filtered = perfs.filter((perf) =>
        matchesFilter(perf.entries, filter)
      );
      if (filtered.length === 0) continue;
      count += filtered.length;
      groups.push([venue, filtered]);
    }

    return { filteredGroups: groups, visiblePerformanceCount: count };
  }, [venueGroups, filter]);

  if (venueGroups.length === 0) {
    return (
      <section className="mt-6 space-y-6">
        <h2 className="text-lg font-semibold text-ink">公演日程</h2>
        <p className="rounded-2xl border border-slate-200/80 bg-white p-6 text-slate-600">
          公演日程がありません。
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 space-y-6">
      <div className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-ink">公演日程</h2>
          <div
            className="inline-flex self-start rounded-lg border border-slate-200 bg-slate-50 p-0.5"
            role="group"
            aria-label="公演日程のフィルタ"
          >
            {FILTER_OPTIONS.map((option) => {
              const selected = filter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFilter(option.value)}
                  className={
                    selected
                      ? "rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-ink shadow-sm ring-1 ring-slate-200/80"
                      : "rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:text-ink"
                  }
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        {filter !== "all" ? (
          <p className="text-sm text-slate-500">
            表示中 {visiblePerformanceCount} 件
          </p>
        ) : null}
      </div>

      {filteredGroups.length === 0 ? (
        <p className="rounded-2xl border border-slate-200/80 bg-white p-6 text-slate-600">
          該当する公演がありません。
        </p>
      ) : (
        filteredGroups.map(([venue, perfs]) => (
          <div
            key={venue}
            className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6"
          >
            <h3 className="text-base font-semibold text-ink">{venue}</h3>
            <ul className="mt-4 divide-y divide-slate-100">
              {perfs.map((perf) => (
                <li key={perf.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-medium text-ink">
                        <span
                          className={dateToneClassName(perf.performanceDate)}
                        >
                          {formatDateWithDow(perf.performanceDate)}
                        </span>
                        <span className="ml-2 text-slate-600">
                          {formatTimeDisplay(perf.startTime)}
                        </span>
                      </p>
                      <div className="mt-2">
                        <EntrySummaryList
                          entries={perf.entries}
                          linkToDetail
                        />
                      </div>
                    </div>
                    <Link
                      href={`/entries/new?performanceId=${perf.id}`}
                      className="inline-flex shrink-0 items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      {perf.entries.length > 0
                        ? "エントリを見る・追加"
                        : "エントリ追加"}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
