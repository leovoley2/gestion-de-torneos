"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/AuthCard";
import { deleteAccount } from "../../actions";

type State = Awaited<ReturnType<typeof deleteAccount>> | null;

/** Eliminar la cuenta (derecho de cancelación): se abre aparte y pide la contraseña. */
export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<State, FormData>(deleteAccount, null);
  const message = state && !state.ok ? { error: state.error } : null;
  return (
    <section className="card border-red-100">
      <h2 className="font-semibold text-navy-900">Eliminar mi cuenta</h2>
      <p className="mt-1 text-sm text-navy-500">
        Se borran tu cuenta, tu perfil, tus inscripciones y tus declaraciones juradas. Tus resultados en torneos pasados
        quedan como registro histórico con tu nombre, pero sin vínculo con tu cuenta, y dejas de sumar puntos en el ranking.
        No se puede deshacer.
      </p>
      {!open ? (
        <button type="button" className="btn mt-3 text-red-700" onClick={() => setOpen(true)}>
          Quiero eliminar mi cuenta
        </button>
      ) : (
        <form action={action} className="mt-3 space-y-3">
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-navy-700">Escribe tu contraseña para confirmar</span>
            <input name="password" type="password" required autoComplete="current-password" className="input max-w-xs" />
          </label>
          <FormMessage state={message} />
          <div className="flex flex-wrap gap-2">
            <button disabled={pending} className="btn bg-red-600 text-white hover:bg-red-700">
              {pending ? "Eliminando…" : "Eliminar definitivamente"}
            </button>
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
