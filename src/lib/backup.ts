import "server-only";
import { gunzipSync, gzipSync } from "node:zlib";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, list, put } from "@vercel/blob";
import { sql } from "@/lib/db";

// Copia de seguridad diaria de TODA la base de datos (Vercel Cron → /api/cron/backup).
// Formato: JSON comprimido con gzip { version, created_at, tables: { tabla: filas[] } }.
// En producción se guarda en Vercel Blob con acceso PRIVADO (contiene datos personales y hashes de
// contraseñas); en desarrollo, sin BLOB_READ_WRITE_TOKEN, en web/.backups/. Se conservan KEEP días.
// Para restaurar: scripts/restore-backup.mjs.

export const KEEP = 30;
const PREFIX = "backups/";
const LOCAL_DIR = path.join(process.cwd(), ".backups");
const blobConfigured = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

/** Tablas que no hace falta copiar: se regeneran solas o no sirven al restaurar. */
const SKIP = new Set(["login_attempts", "email_outbox"]);

export interface BackupInfo {
  key: string; // ruta en Blob (o local:nombre)
  date: string; // AAAA-MM-DD (hora de Lima)
  size: number;
  uploadedAt: string;
}

const todayLima = (now = new Date()) => now.toLocaleDateString("en-CA", { timeZone: "America/Lima" });
const dateOf = (name: string) => name.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? "";

/** Todas las tablas del esquema public con sus filas. */
export async function dumpDatabase(): Promise<{ tables: Record<string, unknown[]>; counts: Record<string, number> }> {
  const names = await sql<{ table_name: string }[]>`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`;
  const tables: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const { table_name } of names) {
    if (SKIP.has(table_name)) continue;
    // to_jsonb conserva tipos (fechas, jsonb, enums) tal como los entiende json_populate_recordset al restaurar.
    const rows = await sql<{ r: unknown }[]>`select to_jsonb(t) as r from ${sql(table_name)} t`;
    tables[table_name] = rows.map((x) => x.r);
    counts[table_name] = rows.length;
  }
  return { tables, counts };
}

export async function listBackups(): Promise<BackupInfo[]> {
  if (!blobConfigured()) {
    const files = await readdir(LOCAL_DIR).catch(() => [] as string[]);
    const out = await Promise.all(
      files
        .filter((f) => f.endsWith(".json.gz"))
        .map(async (f) => {
          const s = await stat(path.join(LOCAL_DIR, f));
          return { key: `local:${f}`, date: dateOf(f), size: s.size, uploadedAt: s.mtime.toISOString() };
        }),
    );
    return out.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }
  const blobs: BackupInfo[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
    for (const b of page.blobs) {
      blobs.push({ key: b.pathname, date: dateOf(b.pathname), size: b.size, uploadedAt: new Date(b.uploadedAt).toISOString() });
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

/**
 * Crea la copia de hoy. Si ya existe una de hoy no hace nada (salvo `force`): así, aunque alguien
 * llame a la ruta del cron muchas veces, no se llena el almacenamiento.
 */
export async function runBackup({ force = false } = {}): Promise<
  { created: true; info: BackupInfo; counts: Record<string, number> } | { created: false; reason: string }
> {
  const date = todayLima();
  const existing = await listBackups();
  if (!force && existing.some((b) => b.date === date)) return { created: false, reason: "Ya existe la copia de hoy" };

  const { tables, counts } = await dumpDatabase();
  const body = gzipSync(JSON.stringify({ version: 1, created_at: new Date().toISOString(), tables }));
  const name = `${PREFIX}${date}.json.gz`;
  let info: BackupInfo;
  if (blobConfigured()) {
    const blob = await put(name, body, { access: "private", contentType: "application/gzip", addRandomSuffix: true });
    info = { key: blob.pathname, date, size: body.length, uploadedAt: new Date().toISOString() };
  } else {
    await mkdir(LOCAL_DIR, { recursive: true });
    const file = `${date}-${Date.now()}.json.gz`;
    await writeFile(path.join(LOCAL_DIR, file), body);
    info = { key: `local:${file}`, date, size: body.length, uploadedAt: new Date().toISOString() };
  }
  await pruneBackups([info, ...existing]);
  return { created: true, info, counts };
}

/** Deja solo las KEEP copias más recientes. */
async function pruneBackups(all: BackupInfo[]) {
  const old = [...all].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)).slice(KEEP);
  for (const b of old) {
    if (b.key.startsWith("local:")) await unlink(path.join(LOCAL_DIR, path.basename(b.key.slice(6)))).catch(() => {});
    else await del(b.key).catch(() => {});
  }
}

/** Contenido de una copia (gzip) para descargarla desde el panel. Solo claves de copias. */
export async function readBackup(key: string): Promise<Buffer | null> {
  if (key.startsWith("local:")) {
    const file = path.basename(key.slice(6));
    if (!file.endsWith(".json.gz")) return null;
    return readFile(path.join(LOCAL_DIR, file)).catch(() => null);
  }
  if (!key.startsWith(PREFIX) || key.includes("..")) return null;
  const r = await get(key, { access: "private" });
  if (!r?.stream) return null;
  return Buffer.from(await new Response(r.stream).arrayBuffer());
}

/** Para pruebas: abre una copia en memoria. */
export const parseBackup = (gz: Buffer) =>
  JSON.parse(gunzipSync(gz).toString("utf8")) as { version: number; created_at: string; tables: Record<string, unknown[]> };
