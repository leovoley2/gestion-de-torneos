import Link from "next/link";
import type { TeamMatch } from "@/lib/athlete-matches";

const TZ = "America/Lima";

/** "Hoy 10:40", "Mañana 09:00", "sáb 22 nov · 16:20" o null. */
export function whenLabel(iso: string | null, now = new Date()): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const day = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: TZ });
  const time = d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  const tomorrow = new Date(now.getTime() + 86_400_000);
  if (day(d) === day(now)) return `Hoy ${time}`;
  if (day(d) === day(tomorrow)) return `Mañana ${time}`;
  const date = d.toLocaleDateString("es-PE", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
  return `${date} · ${time}`;
}

/** Un partido visto desde la dupla del atleta: cuándo, dónde, contra quién y cómo terminó. */
export function TeamMatchRow({
  m,
  opponentName,
  context,
  href,
}: {
  m: TeamMatch;
  opponentName: string;
  /** Torneo y categoría, cuando la lista mezcla varias. */
  context?: string;
  href: string;
}) {
  const when = whenLabel(m.scheduledAt);
  const played = m.status === "finished";
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150 hover:bg-sky-50"
    >
      {played ? (
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${
            m.won ? "bg-emerald-100 text-emerald-800" : "bg-navy-100 text-navy-600"
          }`}
          aria-label={m.won ? "Ganado" : "Perdido"}
        >
          {m.won ? "G" : "P"}
        </span>
      ) : (
        <span className="w-20 shrink-0 text-xs leading-tight font-semibold text-navy-800 tabular-nums">
          {when ?? <span className="font-normal text-navy-400">Por programar</span>}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-navy-900">vs {opponentName}</span>
        <span className="block truncate text-xs text-navy-400">
          {[context, `P${m.number} · ${m.label}`, !played && m.court ? (/^\d+$/.test(m.court) ? `Cancha ${m.court}` : m.court) : null]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      {played && (
        <span className="shrink-0 text-right text-xs font-semibold text-navy-700 tabular-nums">
          {m.walkover ? "W.O." : m.score}
        </span>
      )}
    </Link>
  );
}
