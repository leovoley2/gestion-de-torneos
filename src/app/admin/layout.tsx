import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { signOut } from "@/app/login/actions";
import { Wordmark } from "@/components/Brand";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) redirect("/login");
  return (
    <div className="min-h-screen">
      <header className="bg-ocean sticky top-0 z-20 text-white shadow-[0_8px_24px_-16px_rgb(7_20_41/0.6)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin" className="flex items-center gap-3 rounded-lg">
            <Wordmark dark />
            <span className="hidden rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-sky-200 ring-1 ring-white/15 ring-inset sm:inline">
              Panel
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/admin" className="btn-ghost px-3 py-1.5 text-xs font-medium">
              Torneos
            </Link>
            {can(admin.grants, "athletes.support") && (
              <Link href="/admin/atletas" className="btn-ghost px-3 py-1.5 text-xs font-medium">
                Atletas
              </Link>
            )}
            {can(admin.grants, "ranking.manage") && (
              <Link href="/admin/ranking" className="btn-ghost px-3 py-1.5 text-xs font-medium">
                Ranking
              </Link>
            )}
            {can(admin.grants, "staff.manage") && (
              <Link href="/admin/equipo" className="btn-ghost px-3 py-1.5 text-xs font-medium">
                Equipo
              </Link>
            )}
            <Link href="/" className="btn-ghost hidden px-3 py-1.5 text-xs font-medium sm:inline-flex">
              Sitio público ↗
            </Link>
            <span className="hidden px-2 text-xs text-sky-200/80 lg:inline">{admin.name || admin.email}</span>
            <form action={signOut}>
              <button className="btn-ghost px-3 py-1.5 text-xs font-medium">Salir</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
