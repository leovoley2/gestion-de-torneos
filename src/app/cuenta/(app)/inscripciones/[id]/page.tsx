import { notFound, redirect } from "next/navigation";
import { getAthlete } from "@/lib/athlete-auth";
import { fullName, isMinor, type Athlete } from "@/lib/athletes";
import { GENDER_LABEL, isUuid } from "@/lib/data";
import { formatRange } from "@/lib/format";
import { getRegistration } from "@/lib/registrations";
import { PageTitle } from "@/components/AdminUI";
import { RegistrationBadge } from "@/components/RegistrationBadge";
import { DeclarationUpload, InvitationButtons, WithdrawButton } from "../../RegistrationButtons";

export const metadata = { title: "Inscripción · Vóley Playa" };

const STEPS = ["Invitación enviada", "Compañero confirmó", "Revisión de la organización"] as const;

export default async function RegistrationPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getAthlete();
  if (!me) redirect("/cuenta/ingresar");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const reg = await getRegistration(id);
  // Solo los dos atletas de la inscripción pueden verla.
  if (!reg || (reg.athlete1.id !== me.id && reg.athlete2.id !== me.id)) notFound();

  const c = reg.category;
  const editable = reg.status === "pending_partner" || reg.status === "pending_review";
  const step = reg.status === "pending_partner" ? 1 : reg.status === "pending_review" ? 2 : 3;
  const declarationOf = (a: Athlete) => reg.declarations.find((d) => d.athlete_id === a.id);
  const minors = [reg.athlete1, reg.athlete2].filter((a) => isMinor(a, c.start_date));

  return (
    <div className="space-y-6">
      <PageTitle
        back={{ href: "/cuenta", label: "Mi cuenta" }}
        eyebrow={`${GENDER_LABEL[c.gender]} · ${[c.tournament_city, formatRange(c.start_date, c.end_date)].filter(Boolean).join(" · ")}`}
        title={`${c.tournament_name} · ${c.name}`}
        actions={<RegistrationBadge status={reg.status} />}
      />

      {editable && (
        <ol className="grid gap-2 sm:grid-cols-3" aria-label="Avance">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={`rounded-xl px-4 py-3 text-sm font-medium ring-1 ring-inset ${i < step ? "bg-sky-50 text-navy-800 ring-sky-200" : i === step ? "bg-white text-navy-900 ring-navy-200" : "bg-white text-navy-300 ring-navy-100"}`}
            >
              {i < step ? "✓ " : `${i + 1}. `}
              {label}
            </li>
          ))}
        </ol>
      )}

      {reg.status === "rejected" && reg.admin_note && (
        <p className="card border-red-100 bg-red-50/50 text-sm text-red-800">
          <strong>Motivo de la organización:</strong> {reg.admin_note}
        </p>
      )}
      {reg.status === "accepted" && (
        <p className="card border-sky-200 bg-sky-50/50 text-sm text-navy-800">
          ¡Están inscritos! La programación aparecerá en la página pública del torneo.
        </p>
      )}

      <section className="card">
        <h2 className="mb-3 font-semibold text-navy-900">Dupla</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {[reg.athlete1, reg.athlete2].map((a, i) => (
            <li key={a.id} className="rounded-xl border border-navy-100/70 px-4 py-3">
              <p className="text-[11px] font-semibold tracking-wide text-navy-400 uppercase">{i === 0 ? "Inscribe" : "Compañero/a"}</p>
              <p className="font-semibold text-navy-900">
                {fullName(a) || a.email}
                {a.id === me.id && <span className="font-normal text-navy-400"> (tú)</span>}
              </p>
              {isMinor(a, c.start_date) && <p className="text-xs text-amber-700">Menor de edad</p>}
            </li>
          ))}
        </ul>
        {reg.status === "pending_partner" && reg.athlete2.id === me.id && (
          <div className="mt-4 border-t border-navy-50 pt-4">
            <p className="mb-3 text-sm text-navy-600">{fullName(reg.athlete1)} te invitó. ¿Juegan juntos?</p>
            <InvitationButtons registrationId={reg.id} />
          </div>
        )}
        {reg.status === "pending_partner" && reg.athlete1.id === me.id && (
          <p className="mt-4 text-sm text-navy-400">Esperando que {fullName(reg.athlete2) || "tu compañero"} confirme desde su cuenta.</p>
        )}
      </section>

      {minors.length > 0 && (
        <section className="card space-y-4">
          <div>
            <h2 className="font-semibold text-navy-900">Declaración jurada de menores</h2>
            <p className="mt-0.5 text-sm text-navy-400">
              Cada menor de edad debe subir la declaración jurada firmada por su padre, madre o apoderado. La
              organización no puede aceptar la inscripción sin ellas.
            </p>
          </div>
          <ul className="space-y-3">
            {minors.map((a) => {
              const d = declarationOf(a);
              return (
                <li key={a.id} className="rounded-xl border border-navy-100/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-navy-900">{fullName(a)}</p>
                    <span className={`text-xs font-semibold ${d ? "text-sky-700" : "text-amber-700"}`}>
                      {d ? `✓ Subida: ${d.file_name}` : "Pendiente"}
                    </span>
                  </div>
                  {a.id === me.id && (
                    <div className="mt-3 space-y-3">
                      {d && (
                        <a href={`/api/declaraciones/${reg.id}/${me.id}`} target="_blank" className="text-sm font-semibold text-sky-600">
                          Ver el PDF subido ↗
                        </a>
                      )}
                      {editable && <DeclarationUpload registrationId={reg.id} hasFile={Boolean(d)} />}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {editable && (
        <section className="rounded-2xl border border-red-100 bg-red-50/40 p-5">
          <h2 className="text-sm font-semibold text-red-800">¿Ya no van a jugar?</h2>
          <p className="mt-1 mb-3 text-xs text-red-700/80">Cualquiera de los dos puede retirar la inscripción antes de que sea aceptada.</p>
          <WithdrawButton registrationId={reg.id} />
        </section>
      )}
    </div>
  );
}
