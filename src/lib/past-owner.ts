/** Katsura（過去ログの持ち主）のログイン email。権限・owner 解決の正 */
export const PAST_OWNER_EMAIL = "otsukait666@gmail.com";

/**
 * 過去分析の閲覧専用ユーザー（申込・一覧編集は不可）。
 * ログイン ID として使う文字列（メール形式でなくてよい）。
 */
export const PAST_VIEWER_EMAIL = "past-viewer@fc-app.local";

export function isPastViewerEmail(email: string | null | undefined): boolean {
  return !!email && email === PAST_VIEWER_EMAIL;
}

/** 閲覧専用ユーザーがアクセスしてよいパス */
export function isPastViewerAllowedPath(pathname: string): boolean {
  if (pathname === "/analytics/past") return true;
  // ファビコン等（middleware 対象に残るアセット）
  if (pathname === "/icon.png" || pathname === "/favicon.ico") return true;
  return false;
}
