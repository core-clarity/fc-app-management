import * as holidayJp from "@holiday-jp/holiday_jp";

export function companionTimingLabel(
  value: "at_entry" | "before_show"
): string {
  return value === "at_entry"
    ? "申込時に登録（ソロ可）"
    : "公演前までOK（任意）";
}

export function idVerificationLabel(
  value: "none" | "face_auth" | "other"
): string {
  if (value === "face_auth") return "顔認証あり";
  if (value === "other") return "その他の本人確認あり";
  return "本人確認なし";
}

export function lotteryResultLabel(
  value: "pending" | "won" | "lost"
): string {
  if (value === "won") return "当選";
  if (value === "lost") return "落選";
  return "未設定";
}

export function paymentStatusLabel(
  value: "not_required" | "pending" | "completed"
): string {
  if (value === "completed") return "入金済み";
  if (value === "pending") return "入金未";
  return "入金不要";
}

export function formatTimeDisplay(time: string): string {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return time;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function parseLocalDate(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** YYYY-MM-DD → 日本語曜日文字（月〜日） */
export function dayOfWeekJa(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  if (!date) return "";
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return days[date.getDay()] ?? "";
}

export type HolidayKind = "shukujitsu" | "kyujitsu" | null;

/**
 * 日本の祝日カレンダーで判定。
 * - 国民の休日（休日）→ 休（チケット表記の「火・休」など）
 * - それ以外の祝日・振替休日 → 祝
 */
export function getHolidayKind(dateStr: string): HolidayKind {
  const date = parseLocalDate(dateStr);
  if (!date || !holidayJp.isHoliday(date)) return null;
  const found = holidayJp.between(date, date);
  const name = found[0]?.name ?? "";
  if (name === "休日" || name.includes("国民の休日")) return "kyujitsu";
  return "shukujitsu";
}

/** 曜日＋祝/休。例: 月 / 月・祝 / 火・休 / 日 */
export function dayLabelJa(dateStr: string): string {
  const dow = dayOfWeekJa(dateStr);
  if (!dow) return "";
  const kind = getHolidayKind(dateStr);
  if (kind === "kyujitsu") return `${dow}・休`;
  if (kind === "shukujitsu") return `${dow}・祝`;
  return dow;
}

/** 土=青、日・祝・休=赤 のためのトーン */
export function dateTone(
  dateStr: string
): "saturday" | "holidayish" | "weekday" {
  const date = parseLocalDate(dateStr);
  if (!date) return "weekday";
  const dow = date.getDay();
  if (getHolidayKind(dateStr) || dow === 0) return "holidayish";
  if (dow === 6) return "saturday";
  return "weekday";
}

export function dateToneClassName(dateStr: string): string {
  const tone = dateTone(dateStr);
  if (tone === "holidayish") return "text-red-600";
  if (tone === "saturday") return "text-blue-600";
  return "text-ink";
}

export function formatDateWithDow(dateStr: string): string {
  const label = dayLabelJa(dateStr);
  return label ? `${dateStr}（${label}）` : dateStr;
}
