import Link from "next/link";
import { Wordmark } from "@/components/Brand";

/** Pantalla centrada sobre fondo marino para registro, ingreso y recuperación de cuenta. */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="bg-ocean flex min-h-screen items-center justify-center px-4 py-10">
      <main className="rise w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center">
          <Wordmark dark />
        </Link>
        <div className="rounded-2xl bg-white p-6 shadow-[0_24px_48px_-24px_rgb(7_20_41/0.7)] sm:p-7">
          <h1 className="text-xl font-bold tracking-tight text-navy-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-navy-400">{subtitle}</p>}
          {children}
        </div>
        {footer && <div className="mt-6 space-y-2 text-center text-sm text-sky-200">{footer}</div>}
        <p className="mt-6 text-center text-xs text-sky-200/70">
          <Link href="/privacidad" className="hover:text-white">
            Política de privacidad
          </Link>
        </p>
      </main>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-navy-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-navy-400">{hint}</span>}
    </label>
  );
}

export function FormMessage({ state }: { state: { error?: string; ok?: string } | null }) {
  if (state?.error) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {state.error}
      </p>
    );
  }
  if (state?.ok) {
    return (
      <p role="status" className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
        {state.ok}
      </p>
    );
  }
  return null;
}
