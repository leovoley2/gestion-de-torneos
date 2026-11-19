"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptRegistration, rejectRegistration, updateRegistrationSettings } from "@/app/admin/registration-actions";

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
}: {
  categoryId: string;
  initial: { open: boolean; deadline: string; maxTeams: string; minYear: string; maxYear: string };
}) {
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="grid gap-3 rounded-xl bg-navy-50/50 p-4 sm:grid-cols-2 lg:grid-cols-5"
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
      <label className="flex items-center gap-2 text-sm font-semibold text-navy-800 sm:col-span-2 lg:col-span-5">
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
        Nacidos desde (año)
        <input type="number" name="min_birth_year" defaultValue={initial.minYear} placeholder="Ej. 2008" className="input mt-1" />
      </label>
      <label className="block text-xs font-medium text-navy-600">
        Nacidos hasta (año)
        <input type="number" name="max_birth_year" defaultValue={initial.maxYear} placeholder="—" className="input mt-1" />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-5">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Guardando…" : "Guardar ajustes"}
        </button>
        <Message msg={msg} />
      </div>
    </form>
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
