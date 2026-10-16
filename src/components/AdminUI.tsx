import Link from "next/link";

/** Título de página del panel, con migas opcionales. */
export function PageTitle({
  eyebrow,
  title,
  back,
  actions,
  children,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div>
      {back && (
        <Link
          href={back.href}
          className="text-sm font-medium text-sky-600 transition-colors duration-150 hover:text-navy-800"
        >
          ← {back.label}
        </Link>
      )}
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">{title}</h1>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function PublishedBadge({ published }: { published: boolean }) {
  return published ? (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800 ring-1 ring-sky-200 ring-inset">
      <span className="size-1.5 rounded-full bg-sky-500" aria-hidden="true" />
      Publicado
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center rounded-full bg-navy-50 px-2.5 py-0.5 text-[11px] font-semibold text-navy-500 ring-1 ring-navy-100 ring-inset">
      Borrador
    </span>
  );
}

/** Encabezado de sección dentro de una tarjeta. */
export function SectionTitle({ title, hint }: { title: string; hint?: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="font-semibold text-navy-900">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-navy-400">{hint}</p>}
    </div>
  );
}
