/**
 * スクショ読み取り結果 → DBインポート ユーティリティ
 *
 * Claude Vision APIからのJSONをparseしてperformancesテーブルに一括挿入する
 */

/** Vision APIが返す構造化データ（複数会場対応） */
export type ParsedVenuePerformance = {
  date: string | null; // "YYYY-MM-DD"
  time: string | null; // "HH:MM"
};

export type ParsedVenue = {
  venue: string | null;
  city: string | null;
  performances: ParsedVenuePerformance[];
};

export type ParsedSchedule = {
  title: string | null;
  artist: string | null;
  venues: ParsedVenue[];
};

/**
 * Vision APIへのプロンプトテンプレート（複数会場対応）
 */
export const VISION_PROMPT = `
あなたは舞台・コンサートのFC公演申し込みページのスクリーンショットから
公演スケジュール情報を抽出するアシスタントです。

以下のJSON形式のみで回答してください。前置きや説明文は不要です。

{
  "title": "公演タイトル（ツアー名）",
  "artist": "アーティスト名・出演者名",
  "venues": [
    {
      "venue": "会場名（例：サンシャイン劇場）",
      "city": "都市名（例：東京）",
      "performances": [
        {
          "date": "YYYY-MM-DD",
          "time": "HH:MM"
        }
      ]
    }
  ]
}

注意事項：
- 1日に複数回公演がある場合は performances に複数エントリを追加すること
- 複数の会場（都市）がある場合は venues 配列に全て含めること
- 日付は必ず YYYY-MM-DD 形式で出力すること（画面に「月・祝」「火・休」等があっても日付自体は YYYY-MM-DD）
- 時刻は24時間表記の HH:MM 形式で出力すること
- 祝日・振替休日・休日の表記は日付の解釈にだけ使い、JSONには date/time のみ含めること
- 読み取れない項目は null にすること
`.trim();

/**
 * チケット（半券）画像から座席情報だけを抽出する Vision プロンプト。
 * 画像は永続化せず、フロントの seatInfo 自動入力に使う。
 */
export const SEAT_VISION_PROMPT = `
あなたはコンサート・舞台チケット（半券）の写真から座席情報を読み取るアシスタントです。

以下のJSON形式のみで回答してください。前置きや説明文は不要です。

{
  "seatInfo": "座席情報を1行の文字列で"
}

注意事項：
- seatInfo には、券面に書かれている座席情報（階・ブロック・列・番号など）を人間が読める短い日本語文字列でまとめること
- 例: "1階 バルコニー 12列 5番" / "S席 10列 32番" / "Aブロック 3列 8番"
- 読み取れない場合は seatInfo を null にすること
- 公演名・会場・日付など座席以外は出力しないこと
`.trim();

/** Vision APIが返す座席読み取り結果 */
export type ParsedSeatInfo = {
  seatInfo: string | null;
};

/**
 * "18:00" → "18:00:00" (PostgreSQL time形式に変換)
 */
export function toIsoTime(time: string): string {
  return time.includes(":") && time.split(":").length === 2
    ? `${time}:00`
    : time;
}
