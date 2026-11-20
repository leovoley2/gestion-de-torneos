import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { ARCHIVE_AFTER_DAYS, getArchive } from "@/lib/admin-dashboard";
import { PageTitle } from "@/components/AdminUI";
import { TournamentCard } from "../TournamentCard";

export const metadata = { title: "Archivo · Torneos Vóley Playa" };

type Search = { q?: string; anio?: string; pagina?: string };

export default async function Archive({ searchParams }: { searchParams: Promise<Search> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const year = /^\d{4}$/.test(sp.anio ?? "") ? Number(sp.anio) : undefined;
  const pageNum = /^\d{1,4}$/.test(sp.pagina ?? "") ? Number(sp.pagina) : 1;
  const { tournaments, years, page, hasMore } = await getArchive(admin.grants, { q, year, page: pageNum });

  const href = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (year) params.set("anio", String(year));
    if (p > 1) params.set("pagina", String(p));
    const s = params.toString();
    return `/admin/archivo${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <PageTitle
        back={{ href: "/admin", label: "Inicio" }}
        eyebrow="Torneos anteriores"
        title="Archivo"
      />
      <p className="-mt-3 text-sm text-navy-500">
        Torneos terminados hace más de {Math.round(ARCHIVE_AFTER_DAYS / 30)} meses. Se pueden abrir y
        corregir igual que los demás.
      </p>

      <form className="flex flex-wrap items-center gap-2" role="search">
        <select name="anio" defaultValue={year ?? ""} className="input w-auto py-1.5 text-sm" aria-label="Año">
          <option value="">Todos los años</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar torneo o ciudad"
          aria-label="Buscar torneo"
          className="input w-full flex-1 py-1.5 text-sm sm:w-64 sm:flex-none"
        />
        <button className="btn py-1.5 text-sm">Buscar</button>
        {(q || year) && (
          <Link href="/admin/archivo" className="text-sm text-navy-500 hover:text-navy-800">
            Limpiar
          </Link>
        )}
      </form>

      {tournaments.length === 0 ? (
        <div className="card text-center">
          <p className="font-semibold text-navy-800">
            {q || year ? "Ningún torneo con esa búsqueda" : "Todavía no hay torneos en el archivo"}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {tournaments.map((t) => (
            <li key={t.id}>
              <TournamentCard t={t} />
            </li>
          ))}
        </ul>
      )}

      {(page > 1 || hasMore) && (
        <nav className="flex items-center justify-between" aria-label="Páginas">
          {page > 1 ? (
            <Link href={href(page - 1)} className="btn">
              ← Anteriores
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-navy-400 tabular-nums">Página {page}</span>
          {hasMore ? (
            <Link href={href(page + 1)} className="btn">
              Más antiguos →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
