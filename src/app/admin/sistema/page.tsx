import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { KEEP, listBackups } from "@/lib/backup";
import { recentErrors } from "@/lib/error-alerts";
import { isEmailEnabled } from "@/lib/email";
import { PageTitle } from "@/components/AdminUI";
import { BackupButton } from "./BackupButton";

export const metadata = { title: "Sistema · Panel" };
export const dynamic = "force-dynamic";

const when = (d: Date | string) =>
  new Date(d).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Lima" });
const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** Copias de seguridad, errores recientes y estado de los correos. Solo el administrador general. */
export default async function SystemPage() {
  const admin = await requireAdmin();
  if (!can(admin.grants, "staff.manage")) notFound();
  const [backups, errors] = await Promise.all([listBackups(), recentErrors()]);
  const last = backups[0];
  const stale = !last || Date.now() - Date.parse(last.uploadedAt) > 36 * 3600 * 1000;

  return (
    <div className="max-w-3xl space-y-6">
      <PageTitle back={{ href: "/admin/equipo", label: "Equipo" }} eyebrow="Configuración" title="Sistema" />

      <section className={`card space-y-3 ${stale ? "border-amber-200 bg-amber-50/40" : ""}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-navy-900">Copias de seguridad</h2>
            <p className="mt-0.5 text-sm text-navy-500">
              Se hace una copia completa de la base de datos cada día a las 3:00 a. m. y se guardan las últimas {KEEP}.
              {last ? ` Última copia: ${when(last.uploadedAt)}` : " Todavía no hay copias."}
            </p>
            {stale && last && (
              <p className="mt-1 text-sm font-medium text-amber-800">La última copia tiene más de un día: revisa la tarea programada.</p>
            )}
          </div>
          <BackupButton />
        </div>
        {backups.length > 0 && (
          <ul className="divide-y divide-navy-50 rounded-xl border border-navy-100/70 text-sm">
            {backups.slice(0, 10).map((b) => (
              <li key={b.key} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-navy-800">{when(b.uploadedAt)}</span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-navy-400 tabular-nums">{kb(b.size)}</span>
                  <a href={`/api/admin/backup?key=${encodeURIComponent(b.key)}`} className="text-xs font-semibold text-sky-700 hover:text-sky-900">
                    Descargar
                  </a>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-navy-400">
          Las copias contienen datos personales: guárdalas solo en lugares seguros. Para restaurar una, sigue las instrucciones
          de <code>scripts/restore-backup.mjs</code>.
        </p>
      </section>

      <section className="card space-y-3">
        <div>
          <h2 className="font-semibold text-navy-900">Errores recientes</h2>
          <p className="mt-0.5 text-sm text-navy-500">
            Cuando algo falla en la web, los administradores generales reciben un correo (como máximo uno por hora por cada
            error). Últimos 30 días:
          </p>
        </div>
        {errors.length === 0 ? (
          <p className="text-sm text-emerald-700">Sin errores ✓</p>
        ) : (
          <ul className="space-y-2">
            {errors.map((e) => (
              <li key={e.signature} className="rounded-xl border border-navy-100/70 px-3 py-2 text-sm">
                <p className="font-medium break-words text-navy-900">{e.message}</p>
                <p className="mt-0.5 text-xs text-navy-400">
                  {e.route} · {e.count} {e.count === 1 ? "vez" : "veces"} · última {when(e.last_seen)}
                  {e.digest ? ` · código ${e.digest}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-navy-900">Correos</h2>
          <p className="mt-0.5 text-sm text-navy-500">{isEmailEnabled() ? "Se están enviando." : "No se están enviando."}</p>
        </div>
        <Link href="/admin/correos" className="btn">
          Ver configuración
        </Link>
      </section>
    </div>
  );
}
