/**
 * スクショ読み取り結果 → DBインポート ユーティリティ
 *
 * Claude Vision APIからのJSONをparseしてperformancesテーブルに一括挿入する
 */

// Vision APIが返す構造化データの型
export type ParsedPerformance = {
  productionTitle: string;
  artist: string;
  venue: string;
  performanceDate: string; // "2026/9/8" 形式
  dayOfWeek: string;       // "火" / "水・祝" など
  startTime: string;       // "18:00" 形式
};

export type ParsedSchedule = {
  performances: ParsedPerformance[];
};

/**
 * Vision APIへのプロンプトテンプレート
 * このプロンプトをClaudeに渡してスクショを読み取らせる
 */
export const VISION_PROMPT = `
この画像はファンクラブサイトの公演スケジュールページです。
以下のJSON形式で公演情報を抽出してください。
JSONのみ返してください。前置きや説明は不要です。

{
  "performances": [
    {
      "productionTitle": "演目名またはツアー名",
      "artist": "出演者・アーティスト名",
      "venue": "会場名（[東京]などの地域prefix除く）",
      "performanceDate": "YYYY/M/D形式",
      "dayOfWeek": "曜日（祝日は「水・祝」のように元の表記のまま）",
      "startTime": "HH:MM形式"
    }
  ]
}

注意：
- 1日に複数回公演がある場合は別々のオブジェクトとして出力
- 曜日は画像に表示されているものをそのまま使用
- 会場名の先頭にある[東京]などの地域表記は除く
`.trim();

/**
 * "2026/9/8" → "2026-09-08" (PostgreSQL date形式に変換)
 */
export function toIsoDate(jpDate: string): string {
  const [year, month, day] = jpDate.split("/");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * "18:00" → "18:00:00" (PostgreSQL time形式に変換)
 */
export function toIsoTime(time: string): string {
  return time.includes(":") && time.split(":").length === 2
    ? `${time}:00`
    : time;
}
