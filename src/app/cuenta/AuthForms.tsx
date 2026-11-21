"use client";

import { useActionState } from "react";
import { Field, FormMessage } from "@/components/AuthCard";
import {
  forgotPasswordAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
  type FormState,
} from "./auth-actions";

export function SignUpForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signUpAction, null);
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombres">
          <input name="firstName" required autoComplete="given-name" className="input" defaultValue={state?.values?.firstName} />
        </Field>
        <Field label="Apellidos">
          <input name="lastName" required autoComplete="family-name" className="input" defaultValue={state?.values?.lastName} />
        </Field>
      </div>
      <Field label="Correo">
        <input name="email" type="email" required autoComplete="email" className="input" defaultValue={state?.values?.email} />
      </Field>
      <Field label="Contraseña" hint="Mínimo 8 caracteres.">
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </Field>
      <label className="flex items-start gap-2.5 text-sm text-navy-600">
        <input name="accept_privacy" type="checkbox" required className="mt-0.5 size-4 shrink-0 accent-sky-600" />
        <span>
          Acepto la{" "}
          <a href="/privacidad" target="_blank" className="font-semibold text-sky-700 underline underline-offset-2">
            Política de privacidad
          </a>{" "}
          y autorizo el tratamiento de mis datos para gestionar mis inscripciones y publicar mis resultados.
        </span>
      </label>
      <p className="text-xs text-navy-400">
        Si el atleta tiene menos de 14 años, su padre, madre o apoderado debe crear la cuenta con él.
      </p>
      <FormMessage state={state} />
      <button disabled={pending} className="btn-primary w-full py-2.5">
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </button>
    </form>
  );
}

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signInAction, null);
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Correo">
        <input name="email" type="email" required autoComplete="username" className="input" defaultValue={state?.values?.email} />
      </Field>
      <Field label="Contraseña">
        <input name="password" type="password" required autoComplete="current-password" className="input" />
      </Field>
      <FormMessage state={state} />
      <button disabled={pending} className="btn-primary w-full py-2.5">
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(forgotPasswordAction, null);
  return (
    <form action={action} className="mt-6 space-y-4">
      <Field label="Correo de tu cuenta">
        <input name="email" type="email" required autoComplete="email" className="input" />
      </Field>
      <FormMessage state={state} />
      <button disabled={pending} className="btn-primary w-full py-2.5">
        {pending ? "Enviando…" : "Enviar enlace"}
      </button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resetPasswordAction, null);
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label="Nueva contraseña" hint="Mínimo 8 caracteres.">
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </Field>
      <Field label="Repite la contraseña">
        <input name="password2" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </Field>
      <FormMessage state={state} />
      <button disabled={pending} className="btn-primary w-full py-2.5">
        {pending ? "Guardando…" : "Guardar contraseña"}
      </button>
    </form>
  );
}
