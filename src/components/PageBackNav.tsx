import Link from "next/link";

export type BackNavLink = {
  href: string;
  label: string;
  reloadDocument?: boolean;
};

type PageBackNavProps = {
  links: BackNavLink[];
  variant?: "light" | "dark";
};

const VARIANT_CLASS = {
  light:
    "text-sm font-medium text-brand-dark underline-offset-2 hover:underline",
  dark: "text-sm font-medium text-slate-400 underline-offset-2 hover:text-sky-300 hover:underline",
} as const;

export function PageBackNav({ links, variant = "light" }: PageBackNavProps) {
  if (links.length === 0) return null;

  return (
    <nav className="flex flex-col gap-0.5 leading-tight">
      {links.map((link) => (
        link.reloadDocument ? (
          <a
            key={`${link.href}-${link.label}`}
            href={link.href}
            className={VARIANT_CLASS[variant]}
          >
            ← {link.label}
          </a>
        ) : (
          <Link
            key={`${link.href}-${link.label}`}
            href={link.href}
            className={VARIANT_CLASS[variant]}
          >
            ← {link.label}
          </Link>
        )
      ))}
    </nav>
  );
}
