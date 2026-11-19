import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";
import { safeNext } from "@/lib/safe-redirect";
import { SignUpForm } from "../AuthForms";

export const metadata = { title: "Crear cuenta de atleta · Vóley Playa" };

export default async function RegistroPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next, "/cuenta/perfil", "/cuenta");
  return (
    <AuthCard
      title="Crea tu cuenta de atleta"
      subtitle="Con tu cuenta completas tu perfil y te inscribes con tu dupla en los torneos."
      footer={
        <p>
          ¿Ya tienes cuenta?{" "}
          <Link href={`/cuenta/ingresar?next=${encodeURIComponent(next)}`} className="font-semibold text-white underline-offset-2 hover:underline">
            Ingresa
          </Link>
        </p>
      }
    >
      <SignUpForm next={next} />
    </AuthCard>
  );
}
