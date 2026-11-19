import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";
import { ForgotForm } from "../AuthForms";

export const metadata = { title: "Recuperar contraseña · Vóley Playa" };

export default function RecuperarPage() {
  return (
    <AuthCard
      title="Recupera tu contraseña"
      subtitle="Te enviaremos un enlace a tu correo para elegir una nueva."
      footer={
        <Link href="/cuenta/ingresar" className="hover:text-white">
          ← Volver a ingresar
        </Link>
      }
    >
      <ForgotForm />
    </AuthCard>
  );
}
