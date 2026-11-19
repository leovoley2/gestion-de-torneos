import { notFound } from "next/navigation";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Solo en desarrollo: correos que se habrían enviado (sin proveedor de correo configurado).
 * Sirve para probar los enlaces de confirmación, invitaciones y contraseñas.
 */
export default async function DevOutbox() {
  if (process.env.NODE_ENV === "production") notFound();
  const emails = await sql<{ id: number; to_email: string; subject: string; html: string; created_at: Date }[]>`
    select * from email_outbox order by id desc limit 30`;
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <h1 className="text-xl font-bold text-navy-900">Correos de prueba (solo desarrollo)</h1>
      {emails.map((e) => {
        const links = [...e.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
        return (
          <article key={e.id} className="card space-y-1 text-sm">
            <p className="text-xs text-navy-400">
              #{e.id} · {e.created_at.toLocaleString("es-PE")} · para <strong>{e.to_email}</strong>
            </p>
            <p className="font-semibold text-navy-900">{e.subject}</p>
            {links.map((l) => (
              <a key={l} href={l} className="block truncate text-sky-600" data-testid="email-link">
                {l}
              </a>
            ))}
          </article>
        );
      })}
      {emails.length === 0 && <p className="text-navy-400">Sin correos.</p>}
    </main>
  );
}
