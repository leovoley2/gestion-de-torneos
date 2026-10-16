import Link from "next/link";

/** Marca: balón de vóley estilizado sobre un círculo cielo. */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="logo-sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7dd3fc" />
          <stop offset="1" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="url(#logo-sky)" />
      <g fill="none" stroke="#0c1f3f" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="16" cy="16" r="10.5" />
        <path d="M16 5.5c-2.6 3.4-3.2 7.2-1.8 10.5M26.2 13.5c-4.1-.6-7.8.5-10.3 3M9.4 24.4c1.6-3.9 4.3-6.6 6.6-8.4" />
        <path d="M13.2 16.4c3.4 1 6.1 3.3 7.6 7.1" />
      </g>
    </svg>
  );
}

export function Wordmark({ dark = false }: { dark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="leading-none">
        <span className={`block text-[15px] font-bold tracking-tight ${dark ? "text-white" : "text-navy-900"}`}>
          Vóley Playa
        </span>
        <span className={`block text-[11px] font-medium ${dark ? "text-sky-300" : "text-sky-600"}`}>
          Torneos en vivo
        </span>
      </span>
    </span>
  );
}

/** Cabecera pública: franja marina con brillo cielo. `children` va debajo (título de la página). */
export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="bg-ocean text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="rounded-lg outline-offset-4">
          <Wordmark dark />
        </Link>
        <Link href="/admin" className="btn-ghost px-3 py-1.5 text-xs font-medium">
          Administradores
        </Link>
      </div>
      {children && <div className="mx-auto max-w-6xl px-4 pt-6 pb-10 sm:px-6 sm:pt-10 sm:pb-14">{children}</div>}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto max-w-6xl px-4 py-10 text-xs text-navy-300 sm:px-6">
      Resultados oficiales cargados por la organización del torneo.
    </footer>
  );
}
