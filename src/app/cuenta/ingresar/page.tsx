import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";
import { safeNext } from "@/lib/safe-redirect";
import { SignInForm } from "../AuthForms";

export const metadata = { title: "Ingresar · Atletas · Vóley Playa" };

export default async function IngresarPage({ searchParams }: { searchParams: Promise<{ next?: string; cuenta?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, "/cuenta", "/cuenta");
  const deleted = sp.cuenta === "eliminada";
  return (
    <AuthCard
      title="Ingresa a tu cuenta"
      subtitle="Cuenta de atleta: perfil e inscripciones."
      footer={
        <>
          <p>
            ¿No tienes cuenta?{" "}
            <Link href={`/cuenta/registro?next=${encodeURIComponent(next)}`} className="font-semibold text-white underline-offset-2 hover:underline">
              Regístrate
            </Link>
          </p>
          <p>
            <Link href="/cuenta/recuperar" className="hover:text-white">
              Olvidé mi contraseña
            </Link>
          </p>
        </>
      }
    >
      {deleted && (
        <p role="status" className="mt-4 rounded-lg bg-sky-50 px-3 py-2 text-sm text-navy-700">
          Tu cuenta y tus datos personales fueron eliminados.
        </p>
      )}
      <SignInForm next={next} />
    </AuthCard>
  );
}
