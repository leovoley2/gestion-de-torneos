import { redirect } from "next/navigation";
import { getAthlete } from "@/lib/athlete-auth";
import { PageTitle } from "@/components/AdminUI";
import { ProfileForm } from "./ProfileForm";

export const metadata = { title: "Mi perfil · Vóley Playa" };

export default async function PerfilPage() {
  const me = await getAthlete();
  if (!me) redirect("/cuenta/ingresar");
  return (
    <div className="space-y-6">
      <PageTitle eyebrow="Cuenta de atleta" title="Mi perfil">
        <p className="mt-2 text-sm text-navy-400">
          La organización usa estos datos para aceptar tu inscripción. Solo ellos y tú pueden verlos.
        </p>
      </PageTitle>
      <ProfileForm athlete={me} />
    </div>
  );
}
