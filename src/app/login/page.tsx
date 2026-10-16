import { LoginForm } from "./LoginForm";

export const metadata = { title: "Ingresar · Torneos Vóley Playa" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="text-2xl font-bold">Acceso administradores</h1>
      <p className="mt-1 text-sm text-gray-600">Los resultados son públicos; solo los administradores necesitan ingresar.</p>
      <LoginForm next={next ?? "/admin"} />
    </main>
  );
}
