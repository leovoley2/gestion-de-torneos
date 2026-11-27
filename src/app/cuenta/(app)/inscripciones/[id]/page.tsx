import { notFound, redirect } from "next/navigation";
import { getAthlete } from "@/lib/athlete-auth";
import { fullName, isMinor, type Athlete } from "@/lib/athletes";
import { GENDER_LABEL, isUuid } from "@/lib/data";
import { formatRange } from "@/lib/format";
import { PAYMENT_LABEL, feeOf, formatSoles, getRegistration, paymentStatus } from "@/lib/registrations";
import { PageTitle } from "@/components/AdminUI";
import { appUrl } from "@/lib/email";
import { inviteMessage, whatsappUrl } from "@/lib/whatsapp";
import { RegistrationBadge } from "@/components/RegistrationBadge";
import { DeclarationUpload, InvitationButtons, VoucherUpload, WithdrawButton } from "../../RegistrationButtons";

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
  const fee = feeOf(c);
  const pay = paymentStatus(reg);
  const canPay = ["pending_partner", "pending_review", "accepted"].includes(reg.status) && pay !== "paid";

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
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-sky-50/60 px-4 py-3">
            <p className="text-sm text-navy-600">
              Esperando que {fullName(reg.athlete2) || "tu compañero"} acepte desde su cuenta. Le enviamos un correo; si no lo
              revisa, avísale por WhatsApp.
            </p>
            <a
              href={whatsappUrl(
                inviteMessage({
                  partnerFirstName: reg.athlete2.first_name.trim().split(/\s+/)[0] ?? "",
                  tournament: c.tournament_name,
                  category: c.name,
                  url: `${appUrl()}/cuenta/inscripciones/${reg.id}`,
                }),
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#25D366] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-[filter,transform] duration-150 hover:brightness-95 active:scale-[0.97]"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
                <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
              </svg>
              Avisar por WhatsApp
            </a>
          </div>
        )}
      </section>

      {(fee !== null || pay === "paid") && (
        <section className="card space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-navy-900">Pago de la inscripción</h2>
              {fee !== null && <p className="mt-0.5 text-sm text-navy-500">Monto por dupla: <strong>{formatSoles(fee)}</strong></p>}
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                pay === "paid"
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : pay === "submitted"
                    ? "bg-sky-50 text-sky-700 ring-sky-200"
                    : "bg-amber-50 text-amber-800 ring-amber-200"
              }`}
            >
              {PAYMENT_LABEL[pay]}
            </span>
          </div>
          {pay !== "paid" && c.payment_instructions && (
            <div className="rounded-xl bg-sky-50/60 px-4 py-3 text-sm whitespace-pre-line text-navy-700">{c.payment_instructions}</div>
          )}
          {pay === "submitted" && <p className="text-sm text-navy-500">Enviaste el comprobante; la organización lo revisará.</p>}
          {pay === "paid" && <p className="text-sm text-emerald-700">La organización confirmó el pago. ¡Gracias!</p>}
          {reg.payment_file_name && (
            <a href={`/api/comprobantes/${reg.id}`} target="_blank" className="block text-sm font-semibold text-sky-600">
              Ver el comprobante enviado ↗
            </a>
          )}
          {canPay && <VoucherUpload registrationId={reg.id} hasFile={Boolean(reg.payment_file_name)} />}
        </section>
      )}

      {minors.length > 0 && (
        <section className="card space-y-4">
          <div>
            <h2 className="font-semibold text-navy-900">Declaración jurada de menores</h2>
            <p className="mt-0.5 text-sm text-navy-400">
              Cada menor de edad debe subir la declaración jurada firmada por su padre, madre o apoderado. Descárgala ya
              llenada con tus datos, imprímela, que la firme tu apoderado y súbela escaneada o en foto convertida a PDF. La
              organización no puede aceptar la inscripción sin ella.
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
                      <a
                        href={`/api/declaracion-modelo/${reg.id}/${me.id}`}
                        className="flex items-center gap-3 rounded-xl bg-navy-900 px-4 py-3 text-white transition-colors duration-150 hover:bg-navy-800"
                      >
                        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/10">
                          <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                            <path d="M8 2v8m0 0 3-3m-3 3L5 7M3 12.5h10" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">Descargar declaración jurada (PDF)</span>
                          <span className="block text-xs text-sky-200">
                            Ya llenada con tus datos y los de tu apoderado · Federación Peruana de Voleibol
                          </span>
                        </span>
                      </a>
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
