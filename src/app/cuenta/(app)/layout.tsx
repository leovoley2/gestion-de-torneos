import Link from "next/link";
import { redirect } from "next/navigation";
import { getAthlete } from "@/lib/athlete-auth";
import { isEmailEnabled } from "@/lib/email";
import { Wordmark } from "@/components/Brand";
import { signOutAction } from "../auth-actions";
import { ResendVerification } from "./ResendVerification";
import { AcceptPrivacy } from "./AcceptPrivacy";
import { POLICY_VERSION } from "@/lib/legal";

export const dynamic = "force-dynamic";

const NAV = [
  ["/cuenta", "Mi cuenta"],
  ["/cuenta/perfil", "Perfil"],
  ["/cuenta/inscribirme", "Inscribirme"],
] as const;

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const me = await getAthlete();
  if (!me) redirect("/cuenta/ingresar");
  const needsVerification = isEmailEnabled() && !me.email_verified_at;
  const needsPrivacy = me.privacy_version !== POLICY_VERSION;

  return (
    <div className="min-h-screen">
      <header className="bg-ocean sticky top-0 z-20 text-white shadow-[0_8px_24px_-16px_rgb(7_20_41/0.6)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="rounded-lg">
            <Wordmark dark />
          </Link>
          <form action={signOutAction}>
            <button className="btn-ghost px-3 py-1.5 text-xs font-medium">Salir</button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6" aria-label="Cuenta">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="btn-ghost shrink-0 px-3 py-1.5 text-sm font-medium">
              {label}
            </Link>
          ))}
        </nav>
      </header>
      {needsVerification && (
        <div className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm text-amber-900 sm:px-6">
            <span>
              Confirma tu correo (<strong>{me.email}</strong>) para poder inscribirte.
            </span>
            <ResendVerification />
          </div>
        </div>
      )}
      {needsPrivacy && (
        <div className="border-b border-sky-200 bg-sky-50">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm text-navy-800 sm:px-6">
            <span>
              Publicamos nuestra{" "}
              <Link href="/privacidad" target="_blank" className="font-semibold text-sky-700 underline underline-offset-2">
                Política de privacidad
              </Link>
              . Para inscribirte necesitamos que la aceptes.
            </span>
            <AcceptPrivacy />
          </div>
        </div>
      )}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
      <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs text-navy-300 sm:px-6">
        <Link href="/privacidad" className="hover:text-navy-600">
          Política de privacidad
        </Link>
      </footer>
    </div>
  );
}
