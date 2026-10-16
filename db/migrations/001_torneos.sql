-- Torneos de vóley playa (Postgres / Neon).
-- Seguridad: la base de datos solo la usa el servidor de la app (DATABASE_URL nunca llega al
-- navegador). Las páginas públicas solo leen torneos publicados; toda escritura pasa por
-- acciones que exigen sesión de administrador.

create table admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  start_date date,
  end_date date,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create type category_status as enum ('setup', 'in_progress', 'finished');

create table categories (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name text not null,
  gender text not null check (gender in ('F', 'M', 'X')),
  status category_status not null default 'setup',
  format jsonb,      -- FormatDefinition (src/lib/engine)
  generated jsonb,   -- GeneratedFormat: grupos y partidos
  created_at timestamptz not null default now()
);
create index on categories (tournament_id);

-- Duplas
create table teams (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  player1 text not null,
  player2 text not null,
  seed int not null,
  created_at timestamptz not null default now(),
  unique (category_id, seed) deferrable initially deferred
);
create index on teams (category_id);

-- Resultado de cada partido (clave = MatchGen.key del motor)
create table results (
  category_id uuid not null references categories(id) on delete cascade,
  match_key text not null,
  sets jsonb not null default '[]'::jsonb,
  walkover_winner uuid references teams(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references admins(id) on delete set null,
  primary key (category_id, match_key)
);

-- Programación de cada partido
create table schedule (
  category_id uuid not null references categories(id) on delete cascade,
  match_key text not null,
  court text,
  scheduled_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (category_id, match_key)
);
