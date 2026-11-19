import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";
import { safeNext } from "@/lib/safe-redirect";
import { SignInForm } from "../AuthForms";

export const metadata = { title: "Ingresar · Atletas · Vóley Playa" };

export default async function IngresarPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next, "/cuenta", "/cuenta");
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
      <SignInForm next={next} />
    </AuthCard>
  );
}
