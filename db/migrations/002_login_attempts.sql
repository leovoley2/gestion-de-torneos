-- Intentos fallidos de login, para frenar ataques de fuerza bruta.
-- Se bloquea por 15 minutos tras 5 fallos del mismo correo o 20 desde la misma IP.
create table login_attempts (
  id bigserial primary key,
  email text not null,
  ip text,
  attempted_at timestamptz not null default now()
);
create index on login_attempts (email, attempted_at);
create index on login_attempts (ip, attempted_at);
