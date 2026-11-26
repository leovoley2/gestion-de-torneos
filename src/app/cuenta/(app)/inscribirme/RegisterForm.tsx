"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { FormMessage } from "@/components/AuthCard";
import { createRegistration, lookupPartner, type PartnerLookup } from "../../actions";

export interface WizardCategory {
  id: string;
  name: string;
  genderLabel: string;
  fee: string | null; // "S/ 100"
  paymentInstructions: string | null;
  spots: string | null; // "3 cupos libres"
  state: "open" | "registered" | "full" | "not_for_you";
  note: string | null; // motivo o estado
  registrationId: string | null;
}

export interface WizardStop {
  id: string;
  name: string;
  detail: string; // ciudad · fechas
  closes: string | null;
  categories: WizardCategory[];
}

type State = Awaited<ReturnType<typeof createRegistration>> | null;

/** Inscripción en 3 pasos: categoría → compañero (verificado) → confirmar. */
export function RegisterForm({ stops, selected }: { stops: WizardStop[]; selected?: string }) {
  const all = stops.flatMap((s) => s.categories.map((c) => ({ ...c, stop: s })));
  const initial = all.find((c) => c.id === selected && c.state === "open")?.id ?? null;
  const [categoryId, setCategoryId] = useState<string | null>(initial);
  const [partner, setPartner] = useState("");
  const [lookup, setLookup] = useState<PartnerLookup | null>(null);
  const [checking, startCheck] = useTransition();
  const [state, action, sending] = useActionState<State, FormData>(createRegistration, null);
  const chosen = all.find((c) => c.id === categoryId) ?? null;
  const partnerOk = lookup?.ok === true && lookup.issues.length === 0;

  const check = () =>
    startCheck(async () => {
      if (!categoryId) return;
      setLookup(await lookupPartner(categoryId, partner));
    });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-8">
        {/* Paso 1 */}
        <section className="space-y-4">
          <StepTitle n={1} done={Boolean(chosen)} title="Elige la categoría" />
          {stops.map((s) => (
            <div key={s.id} className="overflow-hidden rounded-2xl bg-white ring-1 ring-navy-100/70">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-navy-50 bg-navy-50/40 px-5 py-3">
                <div>
                  <p className="font-semibold text-navy-900">{s.name}</p>
                  {s.detail && <p className="text-xs text-navy-500">{s.detail}</p>}
                </div>
                {s.closes && <span className="text-xs font-semibold text-amber-700">{s.closes}</span>}
              </div>
              <ul className="divide-y divide-navy-50">
                {s.categories.map((c) => {
                  const selectable = c.state === "open";
                  const isChosen = c.id === categoryId;
                  return (
                    <li key={c.id}>
                      <label
                        className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 transition-colors duration-150 ${selectable ? "cursor-pointer hover:bg-sky-50/50" : "cursor-not-allowed opacity-55"} ${isChosen ? "bg-sky-50" : ""}`}
                      >
                        <input
                          type="radio"
                          name="categoria"
                          className="size-4 shrink-0 accent-navy-800"
                          checked={isChosen}
                          disabled={!selectable}
                          onChange={() => {
                            setCategoryId(c.id);
                            setLookup(null);
                          }}
                        />
                        <span className="min-w-0 flex-1 basis-40">
                          <span className="block font-semibold text-navy-900">
                            {c.name} <span className="font-normal text-navy-400">· {c.genderLabel}</span>
                          </span>
                          <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-navy-500">
                            <span>{c.fee ? `${c.fee} por dupla` : "Sin costo"}</span>
                            {c.spots && <span>{c.spots}</span>}
                          </span>
                        </span>
                        {c.state === "registered" && c.registrationId ? (
                          <Link href={`/cuenta/inscripciones/${c.registrationId}`} className="basis-full pl-8 text-xs font-semibold text-sky-700 sm:basis-auto sm:pl-0">
                            {c.note} →
                          </Link>
                        ) : (
                          c.note && <span className="basis-full pl-8 text-xs font-medium text-navy-500 sm:basis-auto sm:pl-0 sm:text-right">{c.note}</span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>

        {/* Paso 2 */}
        <section className={`space-y-4 transition-opacity duration-200 ${chosen ? "" : "pointer-events-none opacity-40"}`}>
          <StepTitle n={2} done={partnerOk} title="Tu compañero/a" />
          <div className="card space-y-3">
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-navy-700">Correo o número de documento</span>
              <span className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={partner}
                  onChange={(e) => {
                    setPartner(e.target.value);
                    setLookup(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      check();
                    }
                  }}
                  disabled={!chosen}
                  placeholder="companero@correo.com o 12345678"
                  className="input flex-1"
                  autoComplete="off"
                />
                <button type="button" className="btn shrink-0" disabled={!chosen || partner.trim().length < 5 || checking} onClick={check}>
                  {checking ? "Buscando…" : "Buscar"}
                </button>
              </span>
              <span className="mt-1.5 block text-xs text-navy-400">Tu compañero debe tener su cuenta. Le llegará la invitación para confirmar.</span>
            </label>

            {lookup && !lookup.ok && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                {lookup.error}
              </p>
            )}
            {lookup?.ok && (
              <div
                className={`flex items-start gap-3 rounded-xl px-3 py-3 ring-1 ring-inset ${lookup.issues.length ? "bg-amber-50 ring-amber-200" : "bg-emerald-50 ring-emerald-200"}`}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-sm font-bold text-navy-800 ring-1 ring-navy-100">
                  {lookup.partner.initials}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-navy-900">
                    {lookup.partner.short}
                    {lookup.partner.club && <span className="font-normal text-navy-500"> · {lookup.partner.club}</span>}
                  </p>
                  {lookup.issues.length === 0 ? (
                    <p className="text-sm font-medium text-emerald-800">✓ Pueden jugar juntos esta categoría</p>
                  ) : (
                    <ul className="mt-0.5 list-disc pl-4 text-sm text-amber-900">
                      {lookup.issues.map((i) => (
                        <li key={i}>{i}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Paso 3: resumen */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <form action={action} className="card space-y-4">
          <StepTitle n={3} done={false} title="Confirmar" />
          <input type="hidden" name="category_id" value={categoryId ?? ""} />
          <input type="hidden" name="partner" value={partner} />
          <dl className="space-y-3 text-sm">
            <Row label="Parada" value={chosen?.stop.name} />
            <Row label="Categoría" value={chosen ? `${chosen.name} · ${chosen.genderLabel}` : undefined} />
            <Row label="Compañero/a" value={lookup?.ok ? lookup.partner.short : undefined} />
            <Row label="Inscripción" value={chosen ? (chosen.fee ? `${chosen.fee} por dupla` : "Sin costo") : undefined} />
          </dl>
          {chosen?.fee && chosen.paymentInstructions && (
            <div className="rounded-xl bg-sky-50 px-3 py-2.5 text-xs text-navy-700">
              <p className="font-semibold text-navy-900">Cómo pagar</p>
              <p className="mt-1 whitespace-pre-line">{chosen.paymentInstructions}</p>
              <p className="mt-1.5 text-navy-500">El comprobante lo subes después, desde tu inscripción.</p>
            </div>
          )}
          <button className="btn-primary w-full py-2.5" disabled={!chosen || !partnerOk || sending}>
            {sending ? "Enviando…" : "Enviar invitación"}
          </button>
          {!partnerOk && <p className="text-xs text-navy-400">Elige la categoría y busca a tu compañero para continuar.</p>}
          <FormMessage state={state && !state.ok ? { error: state.error } : null} />
          <ol className="space-y-1.5 border-t border-navy-50 pt-3 text-xs text-navy-500">
            <li>1. Tu compañero recibe la invitación y la confirma desde su cuenta.</li>
            <li>2. {chosen?.fee ? "Suben el comprobante de pago." : "Completan lo que falte (menores: declaración jurada)."}</li>
            <li>3. La organización revisa y acepta la dupla.</li>
          </ol>
        </form>
      </aside>
    </div>
  );
}

function StepTitle({ n, done, title }: { n: number; done: boolean; title: string }) {
  return (
    <h2 className="flex items-center gap-2.5 text-base font-semibold text-navy-900">
      <span
        className={`grid size-7 place-items-center rounded-full text-xs font-bold transition-colors duration-200 ${done ? "bg-emerald-500 text-white" : "bg-navy-900 text-white"}`}
        aria-hidden="true"
      >
        {done ? "✓" : n}
      </span>
      {title}
    </h2>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-navy-400">{label}</dt>
      <dd className={`text-right font-medium ${value ? "text-navy-900" : "text-navy-300"}`}>{value ?? "—"}</dd>
    </div>
  );
}
