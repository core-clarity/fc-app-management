export type MemberSymbolKey = "cat" | "cra" | "cup" | "hit" | "crescent";

export type MemberSymbolEntry = {
  key: MemberSymbolKey;
  file: string;
  label: string;
  /** public 配下の URL */
  src: string;
};

export const MEMBER_SYMBOL_CATALOG: readonly MemberSymbolEntry[] = [
  {
    key: "cat",
    file: "cat.png",
    label: "ねこ",
    src: "/member-symbols/cat.png",
  },
  {
    key: "cra",
    file: "cra.png",
    label: "くらげ",
    src: "/member-symbols/cra.png",
  },
  {
    key: "cup",
    file: "cup.png",
    label: "カップ",
    src: "/member-symbols/cup.png",
  },
  {
    key: "hit",
    file: "hit.png",
    label: "ひとで",
    src: "/member-symbols/hit.png",
  },
  {
    key: "crescent",
    file: "crescent-mask.png",
    label: "三日月",
    src: "/member-symbols/crescent-mask.png",
  },
] as const;

const BY_KEY = new Map(
  MEMBER_SYMBOL_CATALOG.map((e) => [e.key, e] as const)
);

export function isMemberSymbolKey(value: unknown): value is MemberSymbolKey {
  return typeof value === "string" && BY_KEY.has(value as MemberSymbolKey);
}

export function getMemberSymbol(
  key: string | null | undefined
): MemberSymbolEntry | null {
  if (!key) return null;
  return BY_KEY.get(key as MemberSymbolKey) ?? null;
}
