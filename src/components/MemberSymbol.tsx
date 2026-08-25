import { getMemberSymbol } from "@/lib/member-symbols";

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
  const entry = getMemberSymbol(symbol);
  if (!entry || !themeColor) return null;

  const needsOutline = isLightColor(themeColor);
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
      <span
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          backgroundColor: themeColor,
          WebkitMaskImage: `url(${entry.src})`,
          maskImage: `url(${entry.src})`,
          WebkitMaskSize: "contain",
          maskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          maskMode: "alpha",
        }}
      />
    </span>
  );
}
