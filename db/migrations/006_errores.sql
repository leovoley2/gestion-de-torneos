-- Errores del servidor agrupados (mismo mensaje en la misma ruta = un registro), para avisar por
-- correo a los administradores generales sin repetir el aviso cada vez.
create table error_events (
  signature text primary key,
  message text not null,
  route text,
  digest text,
  count int not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  last_notified_at timestamptz
);
create index on error_events (last_seen desc);
