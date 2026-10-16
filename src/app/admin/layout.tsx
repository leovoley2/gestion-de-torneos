import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { signOut } from "@/app/login/actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) redirect("/login");
  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/admin" className="font-bold">
            Panel de torneos
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/" className="text-gray-600 hover:underline">
              Ver sitio público
            </Link>
            <span className="hidden text-gray-500 sm:inline">{admin.email}</span>
            <form action={signOut}>
              <button className="btn">Salir</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {children}
      </main>
    </div>
  );
}
