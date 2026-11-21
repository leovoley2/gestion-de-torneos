import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";

// Archivos privados (declaraciones juradas). En producción: Vercel Blob con acceso privado; la
// ruta del archivo nunca llega al navegador y solo se entrega a través de una ruta de la app que
// verifica permisos. En desarrollo, sin BLOB_READ_WRITE_TOKEN, se guardan en web/.uploads/.

const LOCAL_DIR = path.join(process.cwd(), ".uploads");
const blobConfigured = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export async function savePrivateFile(key: string, data: Buffer, contentType: string): Promise<string> {
  if (blobConfigured()) {
    const blob = await put(key, data, { access: "private", contentType, addRandomSuffix: true });
    return blob.pathname;
  }
  const safe = key.replace(/[^a-zA-Z0-9/_.-]/g, "_");
  const file = path.join(LOCAL_DIR, `${Date.now()}-${safe.replace(/\//g, "_")}`);
  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(file, data);
  return `local:${path.basename(file)}`;
}

export async function readPrivateFile(fileKey: string): Promise<ReadableStream<Uint8Array> | Buffer | null> {
  if (fileKey.startsWith("local:")) {
    return readFile(path.join(LOCAL_DIR, path.basename(fileKey.slice(6)))).catch(() => null);
  }
  const result = await get(fileKey, { access: "private" });
  return result?.stream ?? null;
}

export async function deletePrivateFile(fileKey: string): Promise<void> {
  if (fileKey.startsWith("local:")) {
    await unlink(path.join(LOCAL_DIR, path.basename(fileKey.slice(6)))).catch(() => {});
    return;
  }
  await del(fileKey).catch(() => {});
}

/** ¿El contenido es realmente un PDF? (firma "%PDF-" al inicio, no solo la extensión). */
export const isPdf = (data: Buffer) => data.subarray(0, 5).toString("latin1") === "%PDF-";
export { MAX_UPLOAD_BYTES as MAX_PDF_BYTES } from "@/lib/upload-limits";
