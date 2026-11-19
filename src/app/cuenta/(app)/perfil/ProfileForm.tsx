"use client";

import { useActionState, useState } from "react";
import { ADULT_AGE, DOCUMENT_TYPES, ageOn, todayLima, type Athlete } from "@/lib/athletes";
import { Field, FormMessage } from "@/components/AuthCard";
import { updateProfile } from "../../actions";

type State = Awaited<ReturnType<typeof updateProfile>> | null;

export function ProfileForm({ athlete }: { athlete: Athlete }) {
  const [state, action, pending] = useActionState<State, FormData>(updateProfile, null);
  const [birthdate, setBirthdate] = useState(athlete.birthdate ?? "");
  const minor = birthdate ? ageOn(birthdate, todayLima()) < ADULT_AGE : false;
  const v = (k: keyof Athlete) => (athlete[k] as string | null) ?? "";
  const message = state ? (state.ok ? { ok: state.message } : { error: state.error }) : null;

  return (
    <form action={action} className="space-y-6">
      <section className="card space-y-4">
        <h2 className="font-semibold text-navy-900">Datos personales</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombres">
            <input name="first_name" required defaultValue={v("first_name")} autoComplete="given-name" className="input" />
          </Field>
          <Field label="Apellidos">
            <input name="last_name" required defaultValue={v("last_name")} autoComplete="family-name" className="input" />
          </Field>
          <Field label="Tipo de documento">
            <select name="document_type" defaultValue={athlete.document_type} className="input">
              {Object.entries(DOCUMENT_TYPES).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Número de documento">
            <input name="document_number" defaultValue={v("document_number")} className="input uppercase" />
          </Field>
          <Field label="Fecha de nacimiento">
            <input
              name="birthdate"
              type="date"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              max={todayLima()}
              className="input"
            />
          </Field>
          <Field label="Sexo" hint="Define en qué categorías (femenina, masculina o mixta) puedes jugar.">
            <select name="gender" defaultValue={v("gender")} className="input">
              <option value="">Elegir…</option>
              <option value="F">Femenino</option>
              <option value="M">Masculino</option>
            </select>
          </Field>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold text-navy-900">Contacto y club</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Teléfono / WhatsApp">
            <input name="phone" type="tel" defaultValue={v("phone")} autoComplete="tel" className="input" />
          </Field>
          <Field label="Ciudad">
            <input name="city" defaultValue={v("city")} className="input" />
          </Field>
          <Field label="Club o academia (opcional)">
            <input name="club" defaultValue={v("club")} className="input" />
          </Field>
        </div>
        <p className="text-xs text-navy-400">Correo de la cuenta: {athlete.email}</p>
      </section>

      <section
        className={`card space-y-4 ${minor ? "border-sky-200" : ""}`}
        aria-describedby="guardian-help"
        hidden={!minor && !athlete.guardian_name}
      >
        <div>
          <h2 className="font-semibold text-navy-900">Padre, madre o apoderado</h2>
          <p id="guardian-help" className="mt-0.5 text-sm text-navy-400">
            Obligatorio para menores de {ADULT_AGE} años. En cada inscripción se pedirá además la declaración jurada
            firmada por esta persona.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre completo">
            <input name="guardian_name" defaultValue={v("guardian_name")} required={minor} className="input" />
          </Field>
          <Field label="Parentesco">
            <select name="guardian_relationship" defaultValue={v("guardian_relationship")} required={minor} className="input">
              <option value="">Elegir…</option>
              <option>Madre</option>
              <option>Padre</option>
              <option>Apoderado/a</option>
            </select>
          </Field>
          <Field label="Documento">
            <input name="guardian_document" defaultValue={v("guardian_document")} required={minor} className="input" />
          </Field>
          <Field label="Teléfono">
            <input name="guardian_phone" type="tel" defaultValue={v("guardian_phone")} required={minor} className="input" />
          </Field>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary px-5 py-2.5" disabled={pending}>
          {pending ? "Guardando…" : "Guardar perfil"}
        </button>
        <div className="min-w-0 flex-1">
          <FormMessage state={message} />
        </div>
      </div>
    </form>
  );
}
