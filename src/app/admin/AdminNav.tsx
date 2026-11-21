"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
  /** Rutas que también marcan este ítem como activo (p. ej. torneos y categorías). */
  also?: string[];
}

/** Menú del panel: marca la sección actual. */
export function AdminNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const active = (it: NavItem) =>
    it.href === "/admin"
      ? path === "/admin" || (it.also ?? []).some((p) => path.startsWith(p))
      : path.startsWith(it.href) || (it.also ?? []).some((p) => path.startsWith(p));
  return (
    <>
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          aria-current={active(it) ? "page" : undefined}
          className={`btn-ghost shrink-0 px-3 py-1.5 text-xs font-medium ${active(it) ? "bg-white/15 text-white" : ""}`}
        >
          {it.label}
        </Link>
      ))}
    </>
  );
}
