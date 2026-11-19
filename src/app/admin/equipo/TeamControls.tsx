"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ROLE_INFO, type Role } from "@/lib/permissions";
import { addRole, inviteStaff, newActivationLink, removeRole, removeStaff } from "@/app/admin/team-actions";

type Tournament = { id: string; name: string };
type Result = Awaited<ReturnType<typeof inviteStaff>>;

function useAction() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: r.message ?? "Listo" } : { ok: false, text: r.error });
      if (r.ok && r.link) setLink(r.link);
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });
  return { msg, link, pending, run };
}

function Feedback({ msg, link }: { msg: { ok: boolean; text: string } | null; link: string | null }) {
  return (
    <>
      {link && (
        <div className="flex gap-2">
          <input readOnly value={link} className="input text-xs" onFocus={(e) => e.currentTarget.select()} aria-label="Enlace de activación" />
          <button type="button" className="btn px-3 text-xs" onClick={() => navigator.clipboard.writeText(link)}>
            Copiar
          </button>
        </div>
      )}
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-sky-700" : "text-red-700"}`}>
          {msg.text}
        </p>
      )}
    </>
  );
}

function RoleFields({ tournaments }: { tournaments: Tournament[] }) {
  return (
    <>
      <select name="role" required className="input" defaultValue="">
        <option value="" disabled>
          Rol…
        </option>
        {(Object.keys(ROLE_INFO) as Role[]).map((r) => (
          <option key={r} value={r}>
            {ROLE_INFO[r].label}
          </option>
        ))}
      </select>
      <select name="tournament_id" className="input" defaultValue="">
        <option value="">Todos los torneos</option>
        {tournaments.map((t) => (
          <option key={t.id} value={t.id}>
            Solo: {t.name}
          </option>
        ))}
      </select>
    </>
  );
}

export function InviteForm({ tournaments }: { tournaments: Tournament[] }) {
  const { msg, link, pending, run } = useAction();
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      className="card space-y-3 lg:sticky lg:top-24"
      action={(fd) => run(() => inviteStaff(fd), () => formRef.current?.reset())}
    >
      <h2 className="font-semibold text-navy-900">Dar acceso a alguien</h2>
      <input name="name" required placeholder="Nombre" className="input" />
      <input name="email" type="email" required placeholder="Correo" className="input" />
      <RoleFields tournaments={tournaments} />
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Creando…" : "Crear acceso y enlace"}
      </button>
      <Feedback msg={msg} link={link} />
    </form>
  );
}

export function RoleChip({ roleId, label }: { roleId: string; label: string }) {
  const { msg, pending, run } = useAction();
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 py-0.5 pr-1 pl-3 text-xs font-medium text-navy-800 ring-1 ring-sky-200 ring-inset">
      {label}
      <button
        aria-label={`Quitar ${label}`}
        disabled={pending}
        onClick={() => window.confirm(`¿Quitar el rol "${label}"?`) && run(() => removeRole(roleId))}
        className="grid size-5 place-items-center rounded-full text-navy-400 hover:bg-white hover:text-red-700"
      >
        ×
      </button>
      {msg && !msg.ok && <span className="text-red-700">{msg.text}</span>}
    </span>
  );
}

export function MemberControls({ adminId, isMe, tournaments }: { adminId: string; isMe: boolean; tournaments: Tournament[] }) {
  const { msg, link, pending, run } = useAction();
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-2 border-t border-navy-50 pt-3">
      {adding ? (
        <form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]" action={(fd) => run(() => addRole(adminId, fd), () => setAdding(false))}>
          <RoleFields tournaments={tournaments} />
          <button className="btn-primary" disabled={pending}>
            Agregar
          </button>
          <button type="button" className="btn" onClick={() => setAdding(false)}>
            Cancelar
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button className="btn px-3 py-1.5 text-xs" onClick={() => setAdding(true)}>
            Agregar rol
          </button>
          <button className="btn px-3 py-1.5 text-xs" disabled={pending} onClick={() => run(() => newActivationLink(adminId))}>
            Enlace para (re)activar
          </button>
          {!isMe && (
            <button
              className="btn-danger px-3 py-1.5 text-xs"
              disabled={pending}
              onClick={() => window.confirm("¿Quitar todo el acceso de esta persona?") && run(() => removeStaff(adminId))}
            >
              Quitar acceso
            </button>
          )}
        </div>
      )}
      <Feedback msg={msg} link={link} />
    </div>
  );
}
