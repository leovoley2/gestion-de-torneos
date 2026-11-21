// Restaura una copia de seguridad (web/.backups/*.json.gz o una descargada del panel → Sistema).
//
// 1. Crea o elige la base de destino y aplica las migraciones:
//      node --env-file=<archivo .env> scripts/migrate.mjs
// 2. Restaura (REEMPLAZA todos los datos de esa base):
//      node --env-file=<archivo .env> scripts/restore-backup.mjs <copia.json.gz> --confirmar <host-de-la-base>
//
// --confirmar debe repetir el host de DATABASE_URL: así no se pisa la base equivocada por error.
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import postgres from "postgres";

const [file, flag, confirmHost] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
if (!file || !url) {
  console.error("Uso: node --env-file=<.env> scripts/restore-backup.mjs <copia.json.gz> --confirmar <host>");
  process.exit(1);
}
const host = new URL(url).hostname;
if (flag !== "--confirmar" || confirmHost !== host) {
  console.error(`Esto REEMPLAZA todos los datos de la base en ${host}.`);
  console.error(`Si es correcto, repite el comando agregando: --confirmar ${host}`);
  process.exit(1);
}

const backup = JSON.parse(gunzipSync(await readFile(file)).toString("utf8"));
if (backup.version !== 1) throw new Error(`Versión de copia desconocida: ${backup.version}`);
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

const existing = new Set(
  (await sql`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`).map(
    (r) => r.table_name,
  ),
);
const tables = Object.keys(backup.tables).filter((t) => t !== "schema_migrations");
const missing = tables.filter((t) => !existing.has(t));
if (missing.length) {
  console.error(`Faltan tablas en el destino (${missing.join(", ")}). Aplica primero las migraciones.`);
  process.exit(1);
}

// Orden de inserción: primero las tablas de las que dependen otras (claves foráneas).
const fks = await sql`
  select tc.relname as child, tp.relname as parent
  from pg_constraint c
    join pg_class tc on tc.oid = c.conrelid
    join pg_class tp on tp.oid = c.confrelid
    join pg_namespace n on n.oid = tc.relnamespace
  where c.contype = 'f' and n.nspname = 'public' and tc.relname <> tp.relname`;
const order = [];
const pending = new Set(tables);
while (pending.size) {
  const ready = [...pending].filter((t) => !fks.some((f) => f.child === t && pending.has(f.parent)));
  if (!ready.length) throw new Error(`Dependencias circulares entre: ${[...pending].join(", ")}`);
  for (const t of ready.sort()) {
    order.push(t);
    pending.delete(t);
  }
}

await sql.begin(async (tx) => {
  await tx.unsafe(`truncate ${tables.map((t) => `"${t}"`).join(", ")} restart identity cascade`);
  for (const t of order) {
    const rows = backup.tables[t];
    if (!rows.length) continue;
    await tx.unsafe(`insert into "${t}" select * from json_populate_recordset(null::"${t}", $1::text::json)`, [JSON.stringify(rows)]);
    console.log(`  ${t}: ${rows.length}`);
  }
  // Secuencias (columnas serial) al valor más alto restaurado.
  const seqs = await tx`
    select table_name, column_name, pg_get_serial_sequence(quote_ident(table_name), column_name) as seq
    from information_schema.columns where table_schema = 'public' and column_default like 'nextval%'`;
  for (const s of seqs) {
    if (!s.seq || !order.includes(s.table_name)) continue;
    await tx.unsafe(`select setval('${s.seq}', coalesce((select max("${s.column_name}") from "${s.table_name}"), 0) + 1, false)`);
  }
});
console.log(`Restaurada la copia del ${backup.created_at} en ${host}.`);
await sql.end();
