-- Equipo de la organización con roles, fichas de atletas sin cuenta, posiciones finales y ranking.

-- ───────── Roles del equipo ─────────
-- superadmin: todo (incluye equipo y ranking) · organizer: torneos completos · results: resultados y
-- programación · registrations: inscripciones y atención a atletas.
-- tournament_id null = vale para todos los torneos.
create table admin_roles (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references admins(id) on delete cascade,
  role text not null check (role in ('superadmin', 'organizer', 'results', 'registrations')),
  tournament_id uuid references tournaments(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (role <> 'superadmin' or tournament_id is null)
);
create unique index admin_roles_unique on admin_roles (admin_id, role, coalesce(tournament_id, '00000000-0000-0000-0000-000000000000'));

-- Quienes ya eran administradores pasan a ser administradores generales.
insert into admin_roles (admin_id, role) select id, 'superadmin' from admins;

alter table admins add column name text;

-- Enlaces de activación para nuevos miembros del equipo (elegir contraseña).
create table admin_tokens (
  token_hash text primary key,
  admin_id uuid not null references admins(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- ───────── Fichas de atletas sin cuenta ─────────
-- La organización puede crear la ficha de un jugador (sin correo ni contraseña). Si luego se
-- registra, la organización une la ficha con su cuenta y conserva sus duplas y puntos.
alter table athletes alter column email drop not null;
alter table athletes alter column password_hash drop not null;
alter table athletes add column created_by_admin uuid references admins(id) on delete set null;

-- ───────── Ranking ─────────
create table point_tables (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rows jsonb not null, -- [{ "from": 1, "to": 1, "points": 200 }, { "from": 5, "to": 8, "points": 120 }, …]
  created_at timestamptz not null default now()
);

insert into point_tables (name, rows) values
  ('Nacional', '[{"from":1,"to":1,"points":200},{"from":2,"to":2,"points":180},{"from":3,"to":3,"points":160},{"from":4,"to":4,"points":140},{"from":5,"to":8,"points":120},{"from":9,"to":16,"points":100},{"from":17,"to":24,"points":80},{"from":25,"to":32,"points":60},{"from":33,"to":64,"points":40}]'),
  ('Regional', '[{"from":1,"to":1,"points":100},{"from":2,"to":2,"points":90},{"from":3,"to":3,"points":80},{"from":4,"to":4,"points":70},{"from":5,"to":8,"points":60},{"from":9,"to":16,"points":50},{"from":17,"to":32,"points":40}]');

create table rankings (
  id uuid primary key default gen_random_uuid(),
  name text not null,                -- p. ej. "Ranking Nacional Femenino"
  gender text not null check (gender in ('F', 'M', 'X')),
  season int not null,               -- año de la temporada
  published boolean not null default true,
  created_at timestamptz not null default now()
);

alter table categories
  add column ranking_id uuid references rankings(id) on delete set null,
  add column point_table_id uuid references point_tables(id) on delete set null;

-- Correcciones manuales de la posición final de una dupla (si no hay, se usa la calculada).
create table final_positions (
  category_id uuid not null references categories(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  position int not null check (position > 0),
  primary key (category_id, team_id)
);
