-- Cuentas de atletas, inscripciones de duplas y declaraciones juradas de menores.
-- Seguridad: igual que el resto, solo el servidor usa la base. Las acciones de atleta exigen
-- requireAthlete() y solo tocan los datos de ese atleta; las de administración, requireAdmin().

create table athletes (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  email_verified_at timestamptz,
  -- Perfil
  first_name text not null default '',
  last_name text not null default '',
  document_type text not null default 'DNI' check (document_type in ('DNI', 'CE', 'PASAPORTE')),
  document_number text,
  birthdate date,
  gender text check (gender in ('F', 'M')),
  phone text,
  city text,
  club text,
  -- Apoderado (obligatorio si es menor de edad)
  guardian_name text,
  guardian_document text,
  guardian_phone text,
  guardian_relationship text,
  created_ip text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index athletes_document_unique on athletes (document_type, document_number) where document_number is not null;

-- Enlaces de un solo uso: verificar correo y restablecer contraseña (se guarda el hash, no el token).
create table athlete_tokens (
  token_hash text primary key,
  athlete_id uuid not null references athletes(id) on delete cascade,
  purpose text not null check (purpose in ('verify', 'reset')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index on athlete_tokens (athlete_id);

-- Ajustes de inscripción por categoría
alter table categories
  add column registration_open boolean not null default false,
  add column registration_deadline timestamptz,
  add column max_teams int check (max_teams is null or max_teams > 0),
  add column min_birth_year int,  -- p. ej. Sub-19 2026: nacidos desde 2008
  add column max_birth_year int;  -- p. ej. Master +35: nacidos hasta 1991

create type registration_status as enum (
  'pending_partner',  -- esperando que el compañero confirme
  'pending_review',   -- confirmada por ambos, la revisa la organización
  'accepted',
  'rejected',
  'declined',         -- el compañero no aceptó
  'withdrawn'         -- la retiró un atleta
);

create table registrations (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  athlete1_id uuid not null references athletes(id) on delete cascade, -- quien inscribe
  athlete2_id uuid not null references athletes(id) on delete cascade, -- compañero invitado
  status registration_status not null default 'pending_partner',
  admin_note text,
  team_id uuid references teams(id) on delete set null,
  created_at timestamptz not null default now(),
  partner_answered_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references admins(id) on delete set null,
  check (athlete1_id <> athlete2_id)
);
create index on registrations (category_id, status);
create index on registrations (athlete1_id);
create index on registrations (athlete2_id);

-- Declaración jurada firmada por el apoderado: una por atleta menor en cada inscripción.
create table declarations (
  registration_id uuid not null references registrations(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  file_key text not null,      -- ruta en el almacenamiento privado (nunca se expone al navegador)
  file_name text not null,
  file_size int not null,
  uploaded_at timestamptz not null default now(),
  primary key (registration_id, athlete_id)
);

-- Duplas creadas desde una inscripción quedan ligadas a sus atletas
alter table teams
  add column athlete1_id uuid references athletes(id) on delete set null,
  add column athlete2_id uuid references athletes(id) on delete set null;

-- Correos en desarrollo (sin proveedor configurado se guardan aquí para poder probar los enlaces)
create table email_outbox (
  id bigserial primary key,
  to_email text not null,
  subject text not null,
  html text not null,
  created_at timestamptz not null default now()
);
