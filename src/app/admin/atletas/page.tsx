import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { fullName, isMinor, profileIssues, type Athlete } from "@/lib/athletes";
import { sql } from "@/lib/db";
import { isEmailEnabled } from "@/lib/email";
import { PageTitle } from "@/components/AdminUI";
import { AthleteAccessButtons, MergeRecordForm } from "./AthleteAccessButtons";

export const metadata = { title: "Atletas · Panel" };

export default async function AdminAthletes({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const admin = await requireAdmin();
  if (!can(admin.grants, "athletes.support")) notFound();
  const canMerge = can(admin.grants, "ranking.manage");
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  const athletes = await sql<(Athlete & { registrations: number })[]>`
    select a.*, (select count(*)::int from registrations r where r.athlete1_id = a.id or r.athlete2_id = a.id) as registrations
    from athletes a
    where ${q === ""} or coalesce(a.email, '') ilike ${like} or a.document_number ilike ${like}
      or (a.first_name || ' ' || a.last_name) ilike ${like}
    order by a.created_at desc limit 100`;

  return (
    <div className="space-y-6">
      <PageTitle eyebrow="Panel de administración" title="Atletas">
        <p className="mt-2 text-sm text-navy-400">
          Cuentas de atletas registradas.{" "}
          {!isEmailEnabled() &&
            "El envío de correos no está activo: si alguien olvida su contraseña, genera aquí su enlace y envíaselo por WhatsApp."}
        </p>
      </PageTitle>

      <form className="flex max-w-md gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar por nombre, correo o documento" className="input" />
        <button className="btn">Buscar</button>
      </form>

      <ul className="space-y-3">
        {athletes.map((a) => {
          const missing = profileIssues(a);
          return (
            <li key={a.id} className="card flex flex-wrap items-start justify-between gap-4 py-4">
              <div className="min-w-0">
                <p className="font-semibold text-navy-900">
                  {fullName(a) || "(sin nombre)"}
                  {isMinor(a) && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Menor</span>}
                </p>
                <p className="text-sm text-navy-400">
                  {a.email ?? <span className="font-semibold text-navy-600">Ficha sin cuenta</span>}
                  {a.email && !a.email_verified_at ? " · correo sin confirmar" : ""}
                  {a.document_number && ` · ${a.document_type} ${a.document_number}`}
                  {a.phone && ` · ${a.phone}`}
                </p>
                <p className={`mt-1 text-xs ${missing.length ? "text-amber-700" : "text-sky-700"}`}>
                  {missing.length ? `Perfil incompleto: falta ${missing.join(", ")}` : "Perfil completo"} · {a.registrations}{" "}
                  {a.registrations === 1 ? "inscripción" : "inscripciones"}
                </p>
              </div>
              {a.email ? (
                <AthleteAccessButtons athleteId={a.id} verified={Boolean(a.email_verified_at)} />
              ) : canMerge ? (
                <MergeRecordForm recordId={a.id} />
              ) : null}
            </li>
          );
        })}
        {athletes.length === 0 && <li className="card text-sm text-navy-400">{q ? "Sin resultados." : "Todavía no hay atletas registrados."}</li>}
      </ul>
    </div>
  );
}
