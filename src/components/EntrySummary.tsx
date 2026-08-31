import Link from "next/link";
import { MemberSymbol } from "@/components/MemberSymbol";
import {
  lotteryResultLabel,
  paymentStatusLabel,
} from "@/lib/labels";

export type EntryMemberBrief = {
  id: string;
  label: string;
  name: string;
  symbol: string | null;
  themeColor: string | null;
};

export type EntrySummaryData = {
  id: string;
  applicationGroupId?: string | null;
  companionType: "fc_member" | "general_email" | "none";
  companionEmail: string | null;
  member: EntryMemberBrief;
  companionMember: EntryMemberBrief | null;
  /** 当落保存後のみ表示（pending のときは出さない） */
  lotteryResult?: "pending" | "won" | "lost";
  paymentStatus?: "not_required" | "pending" | "completed";
};

function MemberLabel({ member }: { member: EntryMemberBrief }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <MemberSymbol
        symbol={member.symbol}
        themeColor={member.themeColor}
        size={18}
      />
      <span>
        {member.name}
        {member.label}
      </span>
    </span>
  );
}

function companionText(entry: EntrySummaryData) {
  if (entry.companionType === "fc_member" && entry.companionMember) {
    return <MemberLabel member={entry.companionMember} />;
  }
  if (entry.companionType === "general_email" && entry.companionEmail) {
    return <span>{entry.companionEmail}</span>;
  }
  return <span className="text-slate-500">未登録</span>;
}

function ResultBadges({ entry }: { entry: EntrySummaryData }) {
  const result = entry.lotteryResult;
  if (!result || result === "pending") return null;

  const resultClass =
    result === "won"
      ? "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200"
      : "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200";

  return (
    <span className="inline-flex shrink-0 flex-wrap items-center gap-1.5">
      <span
        className={`rounded px-2 py-0.5 text-xs font-semibold ${resultClass}`}
      >
        {lotteryResultLabel(result)}
      </span>
      {result === "won" ? (
        <span
          className={
            entry.paymentStatus === "completed"
              ? "rounded px-2 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200"
              : "rounded px-2 py-0.5 text-xs font-semibold bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200"
          }
        >
          {entry.paymentStatus === "completed"
            ? paymentStatusLabel("completed")
            : paymentStatusLabel("pending")}
        </span>
      ) : null}
    </span>
  );
}

/** 申込／同行と、当落・入金を分けて表示 */
export function EntrySummaryLine({ entry }: { entry: EntrySummaryData }) {
  const result = entry.lotteryResult;
  const showBadges = result === "won" || result === "lost";

  return (
    <div className="min-w-0 text-sm text-ink">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className="text-slate-500">申込：</span>
          <MemberLabel member={entry.member} />
        </span>
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className="text-slate-500">同行：</span>
          {companionText(entry)}
        </span>
        {entry.applicationGroupId ? (
          <span className="rounded bg-sky-50 px-1.5 py-0.5 text-xs font-medium text-sky-800 ring-1 ring-inset ring-sky-200">
            同一申込
          </span>
        ) : null}
      </div>
      {showBadges ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <ResultBadges entry={entry} />
        </div>
      ) : null}
    </div>
  );
}

export function EntrySummaryList({
  entries,
  emptyLabel = "エントリなし",
  linkToDetail = false,
}: {
  entries: EntrySummaryData[];
  emptyLabel?: string;
  /** true のとき各行に「座席・金額」ボタンを付ける */
  linkToDetail?: boolean;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-ink">
        エントリ {entries.length} 件
      </p>
      <ul className="space-y-1.5">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className={
              linkToDetail
                ? "flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                : undefined
            }
          >
            <EntrySummaryLine entry={entry} />
            {linkToDetail ? (
              <Link
                href={`/entries/${entry.id}`}
                className="inline-flex shrink-0 self-end items-center justify-center rounded-lg border border-brand bg-white px-3 py-1.5 text-sm font-semibold text-brand-dark transition hover:bg-brand/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:self-auto"
              >
                座席・金額
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
