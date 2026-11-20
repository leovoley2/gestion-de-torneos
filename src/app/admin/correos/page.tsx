import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { sql } from "@/lib/db";
import { emailStatus } from "@/lib/email";
import { PageTitle } from "@/components/AdminUI";
import { TestEmailButton } from "./TestEmailButton";

export const metadata = { title: "Correos · Panel" };
export const dynamic = "force-dynamic";

/** Estado del envío de correos y cómo activarlo. Solo el administrador general. */
export default async function EmailSettings() {
  const admin = await requireAdmin();
  if (!can(admin.grants, "staff.manage")) notFound();
  const status = emailStatus();
  const [{ unsent, unverified }] = await sql<{ unsent: number; unverified: number }[]>`
    select
      (select count(*)::int from email_outbox where created_at > now() - interval '30 days') as unsent,
      (select count(*)::int from athletes where email is not null and email_verified_at is null) as unverified`;

  return (
    <div className="max-w-3xl space-y-6">
      <PageTitle eyebrow="Configuración" title="Correos" />

      <section className={`card ${status.enabled ? "border-emerald-200" : "border-amber-200 bg-amber-50/40"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-navy-900">
              {status.enabled ? "Los correos se están enviando" : "Los correos no se están enviando"}
            </h2>
            <p className="mt-0.5 text-sm text-navy-500">
              {status.enabled
                ? `Remitente: ${status.from}`
                : "Mientras tanto los atletas no reciben la confirmación de su cuenta, la recuperación de contraseña ni los avisos de inscripción."}
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${status.enabled ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-100 text-amber-800 ring-amber-200"}`}
          >
            {status.enabled ? "Activo" : "Inactivo"}
          </span>
        </div>
        {status.problems.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {status.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-navy-400">Los enlaces de los correos apuntan a {status.appUrl}</p>
        {!status.enabled && unsent > 0 && (
          <p className="mt-1 text-xs text-navy-400">
            {unsent} {unsent === 1 ? "correo quedó" : "correos quedaron"} sin enviar en los últimos 30 días.
          </p>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-navy-900">Probar</h2>
        <p className="text-sm text-navy-500">
          Envía un correo a <strong>{admin.email}</strong> para comprobar que todo funciona.
        </p>
        <TestEmailButton disabled={!status.enabled} />
      </section>

      {!status.enabled && (
        <section className="card space-y-3 text-sm text-navy-600">
          <h2 className="font-semibold text-navy-900">Cómo activarlos</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Compra un dominio (por ejemplo en Vercel → Domains) para el circuito.</li>
            <li>
              Crea una cuenta gratis en <strong>resend.com</strong>, agrega el dominio en “Domains” y copia los registros DNS
              que te muestra en el administrador de tu dominio. Espera a que Resend lo marque como verificado.
            </li>
            <li>En Resend crea una “API Key” con permiso de envío.</li>
            <li>
              En Vercel → proyecto → Settings → Environment Variables agrega <code>RESEND_API_KEY</code>,{" "}
              <code>EMAIL_FROM</code> (p. ej. <code>Vóley Playa &lt;torneos@tudominio.pe&gt;</code>) y <code>APP_URL</code>{" "}
              (la dirección de la web). Luego vuelve a publicar.
            </li>
            <li>Vuelve a esta página y envíate un correo de prueba.</li>
          </ol>
          {unverified > 0 && (
            <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-navy-600">
              Al activarlos, {unverified} {unverified === 1 ? "atleta" : "atletas"} con el correo sin confirmar{" "}
              {unverified === 1 ? "tendrá" : "tendrán"} que confirmarlo antes de inscribirse (desde su cuenta pueden
              pedir el correo de nuevo, o puedes confirmarlo tú en Atletas).
            </p>
          )}
        </section>
      )}
    </div>
  );
}
