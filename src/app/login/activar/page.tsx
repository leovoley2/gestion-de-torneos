import { AuthCard } from "@/components/AuthCard";
import { ActivateForm } from "./ActivateForm";

export const metadata = { title: "Activar acceso · Organización" };

export default async function ActivarPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return (
    <AuthCard title="Activa tu acceso" subtitle="Elige la contraseña con la que entrarás al panel de la organización.">
      <ActivateForm token={token} />
    </AuthCard>
  );
}
