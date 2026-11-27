"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ageRuleSentence, underYear } from "@/lib/age-rule";
import { acceptRegistration, rejectRegistration, setRegistrationPaid, updateRegistrationSettings } from "@/app/admin/registration-actions";

type Msg = { ok: boolean; text: string } | null;
const Message = ({ msg }: { msg: Msg }) =>
  msg && (
    <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-sky-700" : "text-red-700"}`}>
      {msg.ok ? "✓ " : ""}
      {msg.text}
    </p>
  );

export function RegistrationSettingsForm({
  categoryId,
  initial,
  year,
}: {
  categoryId: string;
  initial: { open: boolean; deadline: string; maxTeams: string; minYear: string; maxYear: string; fee: string };
  /** Año de la temporada, para traducir años de nacimiento a edades. */
  year: number;
}) {
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="grid gap-3 rounded-xl bg-navy-50/50 p-4 sm:grid-cols-2 lg:grid-cols-6"
      action={(fd) =>
        start(async () => {
          // La fecha local se envía como ISO para no depender de la zona horaria del servidor.
          const d = String(fd.get("registration_deadline") ?? "");
          fd.set("registration_deadline", d ? new Date(d).toISOString() : "");
          const r = await updateRegistrationSettings(categoryId, fd);
          setMsg(r.ok ? { ok: true, text: r.message ?? "Guardado" } : { ok: false, text: r.error });
          if (r.ok) router.refresh();
        })
      }
    >
      <label className="flex items-center gap-2 text-sm font-semibold text-navy-800 sm:col-span-2 lg:col-span-6">
        <input type="checkbox" name="registration_open" defaultChecked={initial.open} className="size-4 accent-navy-800" />
        Inscripciones abiertas (los atletas pueden inscribirse desde su cuenta)
      </label>
      <label className="block text-xs font-medium text-navy-600 lg:col-span-2">
        Cierre de inscripciones (opcional)
        <input type="datetime-local" name="registration_deadline" defaultValue={initial.deadline} className="input mt-1" />
      </label>
      <label className="block text-xs font-medium text-navy-600">
        Cupo de duplas
        <input type="number" name="max_teams" min={2} defaultValue={initial.maxTeams} placeholder="Sin límite" className="input mt-1" />
      </label>
      <label className="block text-xs font-medium text-navy-600">
        Monto por dupla (S/)
        <input type="number" name="registration_fee" min={0} step="0.01" defaultValue={initial.fee} placeholder="Gratis" className="input mt-1" />
      </label>
      <AgeRuleFields minYear={initial.minYear} maxYear={initial.maxYear} year={year} />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-6">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Guardando…" : "Guardar ajustes"}
        </button>
        <Message msg={msg} />
      </div>
    </form>
  );
}

/** Edad libre o con límite, con la frase de quiénes pueden inscribirse calculada en vivo. */
function AgeRuleFields({ minYear, maxYear, year }: { minYear: string; maxYear: string; year: number }) {
  const [limited, setLimited] = useState(Boolean(minYear || maxYear));
  const [min, setMin] = useState(minYear);
  const [max, setMax] = useState(maxYear);
  const toYear = (v: string) => (/^\d{4}$/.test(v.trim()) ? Number(v) : null);
  const rule = limited ? { min_birth_year: toYear(min), max_birth_year: toYear(max) } : { min_birth_year: null, max_birth_year: null };
  const inverted = rule.min_birth_year && rule.max_birth_year && rule.min_birth_year > rule.max_birth_year;
  const option = (on: boolean, label: string, hint: string) => (
    <label
      className={`flex flex-1 basis-48 cursor-pointer items-start gap-2.5 rounded-lg bg-white px-3 py-2.5 ring-1 ring-inset transition-colors ${limited === on ? "ring-navy-700" : "ring-navy-100 hover:ring-navy-300"}`}
    >
      <input type="radio" name="age_mode" checked={limited === on} onChange={() => setLimited(on)} className="mt-0.5 size-4 accent-navy-800" />
      <span>
        <span className="block text-sm font-semibold text-navy-900">{label}</span>
        <span className="block text-xs text-navy-500">{hint}</span>
      </span>
    </label>
  );
  return (
    <fieldset className="space-y-3 sm:col-span-2 lg:col-span-6">
      <legend className="mb-1.5 text-xs font-medium text-navy-600">Edad de los atletas</legend>
      <div className="flex flex-wrap gap-2">
        {option(false, "Edad libre", "Cualquier edad (adultos, libre)")}
        {option(true, "Con límite de edad", "Menores: U15, U17, U19, U21…")}
      </div>
      {limited && (
        <div className="space-y-3 rounded-lg bg-white p-3 ring-1 ring-navy-100 ring-inset">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-navy-500">Atajo {year}:</span>
            {[15, 17, 19, 21, 23].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setMin(String(underYear(n, year)));
                  setMax("");
                }}
                className="rounded-full bg-navy-50 px-2.5 py-1 font-semibold text-navy-700 hover:bg-navy-100"
              >
                U{n}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-navy-600">
              Nacidos desde (año) <span className="font-normal text-navy-400">· el mayor permitido</span>
              <input
                type="number"
                name="min_birth_year"
                value={min}
                onChange={(e) => setMin(e.target.value)}
                placeholder={`Ej. ${underYear(21, year)}`}
                className="input mt-1"
              />
            </label>
            <label className="block text-xs font-medium text-navy-600">
              Nacidos hasta (año) <span className="font-normal text-navy-400">· opcional, el menor permitido</span>
              <input type="number" name="max_birth_year" value={max} onChange={(e) => setMax(e.target.value)} placeholder="Sin límite" className="input mt-1" />
            </label>
          </div>
        </div>
      )}
      <p className={`rounded-lg px-3 py-2 text-sm font-medium ${inverted ? "bg-red-50 text-red-800" : "bg-sky-50 text-sky-900"}`} aria-live="polite">
        {inverted ? "«Nacidos desde» debe ser un año anterior o igual a «nacidos hasta»." : ageRuleSentence(rule, year)}
      </p>
    </fieldset>
  );
}

export function RegistrationDecision({ registrationId, canAccept }: { registrationId: string; canAccept: boolean }) {
  const [msg, setMsg] = useState<Msg>(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => ReturnType<typeof acceptRegistration>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: r.message ?? "Listo" } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });

  return (
    <div className="space-y-3">
      {!rejecting ? (
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-primary"
            disabled={pending || !canAccept}
            title={canAccept ? undefined : "Resuelve lo pendiente antes de aceptar"}
            onClick={() => run(() => acceptRegistration(registrationId))}
          >
            Aceptar dupla
          </button>
          <button className="btn" disabled={pending} onClick={() => setRejecting(true)}>
            Rechazar…
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Motivo (los atletas lo verán). Ej.: falta el pago de la inscripción."
            className="input"
          />
          <div className="flex gap-2">
            <button className="btn-danger" disabled={pending} onClick={() => run(() => rejectRegistration(registrationId, note))}>
              Confirmar rechazo
            </button>
            <button className="btn" disabled={pending} onClick={() => setRejecting(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      <Message msg={msg} />
    </div>
  );
}

export function PaymentToggle({ registrationId, paid }: { registrationId: string; paid: boolean }) {
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        className={paid ? "btn px-3 py-1 text-xs" : "btn-primary px-3 py-1 text-xs"}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await setRegistrationPaid(registrationId, !paid);
            setMsg(r.ok ? null : { ok: false, text: r.error });
            if (r.ok) router.refresh();
          })
        }
      >
        {pending ? "…" : paid ? "Quitar «pagado»" : "Marcar pagado"}
      </button>
      <Message msg={msg} />
    </span>
  );
}
