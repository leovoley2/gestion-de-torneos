"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-navy-700">Correo</span>
        <input name="email" type="email" required autoComplete="username" className="input" defaultValue={state?.email} />
      </label>
      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-navy-700">Contraseña</span>
        <input name="password" type="password" required autoComplete="current-password" className="input" />
      </label>
      {state && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button disabled={pending} className="btn-primary w-full py-2.5">
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
