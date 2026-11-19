import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";
import { ResetForm } from "../AuthForms";

export const metadata = { title: "Nueva contraseña · Vóley Playa" };

export default async function RestablecerPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return (
    <AuthCard
      title="Elige una nueva contraseña"
      footer={
        <Link href="/cuenta/recuperar" className="hover:text-white">
          Pedir otro enlace
        </Link>
      }
    >
      <ResetForm token={token} />
    </AuthCard>
  );
}
