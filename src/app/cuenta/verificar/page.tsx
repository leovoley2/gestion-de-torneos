import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";
import { verifyEmail } from "@/lib/athlete-auth";

export const metadata = { title: "Confirmar correo · Vóley Playa" };
export const dynamic = "force-dynamic";

export default async function VerificarPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const ok = await verifyEmail(token);
  return (
    <AuthCard
      title={ok ? "¡Correo confirmado!" : "El enlace no es válido"}
      subtitle={
        ok
          ? "Tu cuenta está activa. Ya puedes completar tu perfil e inscribirte."
          : "Puede que ya lo hayas usado o que haya vencido. Desde tu cuenta puedes pedir uno nuevo."
      }
    >
      <Link href="/cuenta" className="btn-primary mt-6 w-full py-2.5">
        Ir a mi cuenta
      </Link>
    </AuthCard>
  );
}
