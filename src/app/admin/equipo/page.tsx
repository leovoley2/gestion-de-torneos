import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ROLE_INFO, can, type Role } from "@/lib/permissions";
import { PageTitle } from "@/components/AdminUI";
import { InviteForm, MemberControls, RoleChip } from "./TeamControls";

export const metadata = { title: "Equipo · Panel" };

interface Member {
  id: string;
  email: string;
  name: string | null;
  created_at: Date;
  activated: boolean;
  roles: { id: string; role: Role; tournament_id: string | null; tournament_name: string | null }[];
}

export default async function TeamPage() {
  const me = await getAdmin();
  if (!me || !can(me.grants, "staff.manage")) notFound();

  const [members, tournaments] = await Promise.all([
    sql<Member[]>`
      select a.id, a.email, a.name, a.created_at,
        not exists (select 1 from admin_tokens t where t.admin_id = a.id and t.used_at is null and t.expires_at > now())
          as activated,
        coalesce(json_agg(json_build_object('id', r.id, 'role', r.role, 'tournament_id', r.tournament_id, 'tournament_name', t.name)
          order by r.created_at) filter (where r.id is not null), '[]') as roles
      from admins a
      left join admin_roles r on r.admin_id = a.id
      left join tournaments t on t.id = r.tournament_id
      group by a.id order by a.created_at`,
    sql<{ id: string; name: string }[]>`select id, name from tournaments order by start_date desc nulls first, created_at desc`,
  ]);

  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Panel de administración" title="Equipo de la organización">
        <p className="mt-2 max-w-2xl text-sm text-navy-400">
          Da acceso a otras personas con el rol que necesitan, para todos los torneos o solo para uno. Cada persona
          recibe un enlace para elegir su contraseña.{" "}
          <Link href="/admin/correos" className="font-medium text-sky-700 hover:text-sky-900">
            Configuración de correos →
          </Link>
        </p>
      </PageTitle>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(ROLE_INFO) as Role[]).map((r) => (
          <div key={r} className="card px-4 py-3">
            <p className="text-sm font-semibold text-navy-900">{ROLE_INFO[r].label}</p>
            <p className="mt-0.5 text-xs text-navy-400">{ROLE_INFO[r].description}</p>
          </div>
        ))}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <ul className="space-y-3">
          {members.map((m) => (
            <li key={m.id} className="card space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-navy-900">
                    {m.name || m.email}
                    {m.id === me.id && <span className="font-normal text-navy-400"> (tú)</span>}
                  </p>
                  <p className="text-sm text-navy-400">
                    {m.email}
                    {!m.activated && <span className="ml-2 font-semibold text-amber-700">· enlace sin usar</span>}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {m.roles.map((r) => (
                  <RoleChip
                    key={r.id}
                    roleId={r.id}
                    label={`${ROLE_INFO[r.role].label} · ${r.tournament_name ?? "Todos los torneos"}`}
                  />
                ))}
                {m.roles.length === 0 && <span className="text-xs text-amber-700">Sin roles: no puede entrar al panel</span>}
              </div>
              <MemberControls adminId={m.id} isMe={m.id === me.id} tournaments={tournaments} />
            </li>
          ))}
        </ul>
        <InviteForm tournaments={tournaments} />
      </div>
    </div>
  );
}
