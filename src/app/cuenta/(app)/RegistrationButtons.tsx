"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, tooBigMessage } from "@/lib/upload-limits";
import { respondInvitation, uploadDeclaration, uploadPaymentVoucher, withdrawRegistration } from "../actions";

type Msg = { ok: boolean; text: string } | null;

function Message({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-sky-700" : "text-red-700"}`}>
      {msg.ok ? "✓ " : ""}
      {msg.text}
    </p>
  );
}

export function InvitationButtons({ registrationId }: { registrationId: string }) {
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const respond = (accept: boolean) =>
    start(async () => {
      const r = await respondInvitation(registrationId, accept);
      setMsg(r.ok ? { ok: true, text: r.message ?? "Listo" } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending} onClick={() => respond(true)}>
          Aceptar
        </button>
        <button
          className="btn"
          disabled={pending}
          onClick={() => window.confirm("¿Rechazar la invitación?") && respond(false)}
        >
          Rechazar
        </button>
      </div>
      <Message msg={msg} />
    </div>
  );
}

export function WithdrawButton({ registrationId }: { registrationId: string }) {
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-2">
      <button
        className="btn-danger"
        disabled={pending}
        onClick={() =>
          window.confirm("¿Retirar esta inscripción? Tendrán que inscribirse de nuevo si cambian de opinión.") &&
          start(async () => {
            const r = await withdrawRegistration(registrationId);
            setMsg(r.ok ? { ok: true, text: r.message ?? "Listo" } : { ok: false, text: r.error });
            if (r.ok) router.refresh();
          })
        }
      >
        Retirar inscripción
      </button>
      <Message msg={msg} />
    </div>
  );
}

export function DeclarationUpload({ registrationId, hasFile }: { registrationId: string; hasFile: boolean }) {
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  return (
    <form
      ref={formRef}
      className="space-y-3"
      action={(fd) =>
        start(async () => {
          // Antes de enviar: un archivo muy pesado ni siquiera llega al servidor.
          const f = fd.get("file");
          if (f instanceof File && f.size > MAX_UPLOAD_BYTES) {
            setMsg({ ok: false, text: tooBigMessage(f.size) });
            return;
          }
          const r = await uploadDeclaration(registrationId, fd);
          setMsg(r.ok ? { ok: true, text: r.message ?? "Listo" } : { ok: false, text: r.error });
          if (r.ok) {
            formRef.current?.reset();
            router.refresh();
          }
        })
      }
    >
      <input
        type="file"
        name="file"
        accept="application/pdf,.pdf"
        required
        className="block w-full text-sm text-navy-700 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-navy-800"
      />
      <p className="text-xs text-navy-400">PDF firmado por el padre, madre o apoderado. Máximo {MAX_UPLOAD_LABEL}.</p>
      <button className="btn-primary" disabled={pending}>
        {pending ? "Subiendo…" : hasFile ? "Reemplazar PDF" : "Subir PDF"}
      </button>
      <Message msg={msg} />
    </form>
  );
}

export function VoucherUpload({ registrationId, hasFile }: { registrationId: string; hasFile: boolean }) {
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  return (
    <form
      ref={formRef}
      className="space-y-3"
      action={(fd) =>
        start(async () => {
          // Antes de enviar: un archivo muy pesado ni siquiera llega al servidor.
          const f = fd.get("file");
          if (f instanceof File && f.size > MAX_UPLOAD_BYTES) {
            setMsg({ ok: false, text: tooBigMessage(f.size) });
            return;
          }
          const r = await uploadPaymentVoucher(registrationId, fd);
          setMsg(r.ok ? { ok: true, text: r.message ?? "Listo" } : { ok: false, text: r.error });
          if (r.ok) {
            formRef.current?.reset();
            router.refresh();
          }
        })
      }
    >
      <input
        type="file"
        name="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        required
        className="block w-full text-sm text-navy-700 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-navy-800"
      />
      <p className="text-xs text-navy-400">Captura de Yape o foto/PDF de la transferencia. Máximo {MAX_UPLOAD_LABEL}.</p>
      <button className="btn-primary" disabled={pending}>
        {pending ? "Subiendo…" : hasFile ? "Reemplazar comprobante" : "Subir comprobante"}
      </button>
      <Message msg={msg} />
    </form>
  );
}
