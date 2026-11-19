"use client";

import { useActionState } from "react";
import { Field, FormMessage } from "@/components/AuthCard";
import { activateAccount, type ActivateState } from "../actions";

export function ActivateForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ActivateState, FormData>(activateAccount, null);
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label="Contraseña" hint="Mínimo 10 caracteres.">
        <input name="password" type="password" required minLength={10} autoComplete="new-password" className="input" />
      </Field>
      <Field label="Repite la contraseña">
        <input name="password2" type="password" required minLength={10} autoComplete="new-password" className="input" />
      </Field>
      <FormMessage state={state} />
      <button disabled={pending} className="btn-primary w-full py-2.5">
        {pending ? "Activando…" : "Activar y entrar"}
      </button>
    </form>
  );
}
