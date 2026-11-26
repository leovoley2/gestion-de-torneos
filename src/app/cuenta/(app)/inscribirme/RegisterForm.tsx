"use client";

import { useActionState } from "react";
import { Field, FormMessage } from "@/components/AuthCard";
import { createRegistration } from "../../actions";

interface Option {
  id: string;
  title: string;
  detail: string;
  rules: string;
  full: boolean;
  fee: string | null; // "S/ 100"
  paymentInstructions: string | null;
}

type State = Awaited<ReturnType<typeof createRegistration>> | null;

export function RegisterForm({ options, selected }: { options: Option[]; selected?: string }) {
  const [state, action, pending] = useActionState<State, FormData>(createRegistration, null);
  const initial = options.find((o) => o.id === selected && !o.full)?.id ?? options.find((o) => !o.full)?.id;
  const message = state && !state.ok ? { error: state.error } : null;

  return (
    <form action={action} className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="mb-2 font-semibold text-navy-900">1. Categoría</legend>
        {options.map((o) => (
          <label
            key={o.id}
            className={`group flex cursor-pointer items-start gap-3 rounded-2xl border bg-white p-4 transition-colors duration-150 has-[:checked]:border-sky-400 has-[:checked]:bg-sky-50/50 ${o.full ? "cursor-not-allowed opacity-50" : "border-navy-100 hover:border-sky-200"}`}
          >
            <input type="radio" name="category_id" value={o.id} defaultChecked={o.id === initial} disabled={o.full} required className="mt-1 accent-navy-800" />
            <span>
              <span className="block font-semibold text-navy-900">{o.title}</span>
              {o.detail && <span className="block text-sm text-navy-400">{o.detail}</span>}
              <span className="mt-1 block text-xs font-medium text-sky-700">{o.full ? "Cupo completo" : o.rules}</span>
              {o.fee && !o.full && (
                // Se despliega solo en la categoría elegida: cuánto y cómo pagar.
                <span className="mt-3 hidden rounded-xl bg-white px-3 py-2.5 text-sm text-navy-700 ring-1 ring-sky-200 group-has-[:checked]:block">
                  <span className="block font-semibold text-navy-900">Inscripción: {o.fee} por dupla</span>
                  {o.paymentInstructions && <span className="mt-1 block whitespace-pre-line">{o.paymentInstructions}</span>}
                  <span className="mt-1.5 block text-xs text-navy-500">
                    Después de enviar la invitación podrás subir la foto o captura del comprobante desde tu inscripción.
                  </span>
                </span>
              )}
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="card space-y-4">
        <legend className="sr-only">2. Compañero</legend>
        <p className="font-semibold text-navy-900">2. Tu compañero</p>
        <Field label="Correo o número de documento de tu compañero" hint="Debe estar registrado. Le llegará la invitación para confirmar.">
          <input name="partner" required minLength={5} className="input" placeholder="compañero@correo.com o 12345678" />
        </Field>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary px-5 py-2.5" disabled={pending}>
          {pending ? "Enviando…" : "Enviar invitación"}
        </button>
        <div className="min-w-0 flex-1">
          <FormMessage state={message} />
        </div>
      </div>
    </form>
  );
}
