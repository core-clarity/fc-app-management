import type { ReactNode } from "react";

type SymbolKey = "cat" | "crescent";

const SYMBOLS: Record<SymbolKey, (color: string) => ReactNode> = {
  // GitHub Octocat のように、耳＋丸い顔がはっきりした猫シルエット
  cat: (color) => (
    <svg viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
      <path d="M3.8 10.2 7.6 2.4c.4-.7 1.4-.5 1.55.3L10.5 10 3.8 10.2z" />
      <path d="M20.2 10.2 16.4 2.4c-.4-.7-1.4-.5-1.55.3L13.5 10 20.2 10.2z" />
      <ellipse cx="12" cy="14.4" rx="8.4" ry="7.6" />
    </svg>
  ),
  // 添付画像の正円＋右三日月をマスクとして使う（テーマ色が本体・三日月は透過＝白地）
  crescent: (color) => (
    <span
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        backgroundColor: color,
        WebkitMaskImage: "url(/member-symbols/crescent-mask.png)",
        maskImage: "url(/member-symbols/crescent-mask.png)",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        maskMode: "alpha",
      }}
    />
  ),
};

function isLightColor(hex: string): boolean {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return false;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.85;
}

export function MemberSymbol({
  symbol,
  themeColor,
  size = 24,
}: {
  symbol: string | null | undefined;
  themeColor: string | null | undefined;
  size?: number;
}) {
  if (!symbol || !themeColor) return null;
  const render = SYMBOLS[symbol as SymbolKey];
  if (!render) return null;

  const isCrescent = symbol === "crescent";
  const needsOutline = !isCrescent && isLightColor(themeColor);
  const bg = needsOutline ? "#64748b" : "transparent";

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        boxShadow: needsOutline ? "inset 0 0 0 1px #94a3b8" : undefined,
        padding: needsOutline ? Math.max(1, Math.round(size * 0.08)) : 0,
      }}
      aria-hidden
    >
      <span style={{ width: "100%", height: "100%", display: "block" }}>
        {render(themeColor)}
      </span>
    </span>
  );
}
