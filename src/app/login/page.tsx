import Link from "next/link";
import { LoginForm } from "./LoginForm";
import { Wordmark } from "@/components/Brand";

export const metadata = { title: "Ingresar · Torneos Vóley Playa" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="bg-ocean flex min-h-screen items-center justify-center px-4 py-10">
      <main className="rise w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center">
          <Wordmark dark />
        </Link>
        <div className="rounded-2xl bg-white p-6 shadow-[0_24px_48px_-24px_rgb(7_20_41/0.7)] sm:p-7">
          <h1 className="text-xl font-bold tracking-tight text-navy-900">Acceso administradores</h1>
          <p className="mt-1 text-sm text-navy-400">
            Los resultados son públicos; solo la organización necesita ingresar.
          </p>
          <LoginForm next={next ?? "/admin"} />
        </div>
        <Link href="/" className="mt-6 block text-center text-sm text-sky-200 transition-colors duration-150 hover:text-white">
          ← Volver a los resultados
        </Link>
      </main>
    </div>
  );
}
