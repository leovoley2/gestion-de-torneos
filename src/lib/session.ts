import { SignJWT, jwtVerify } from "jose";

// Firma y verificación de sesiones. Sin dependencias de Node: lo usa también el middleware.
// Hay dos tipos de sesión, cada una en su cookie y con su "typ" firmado: un token de atleta
// nunca sirve como sesión de administrador (ni al revés).
export type Role = "admin" | "athlete";

export const SESSION_COOKIE = "torneos_session"; // administradores
export const ATHLETE_COOKIE = "atleta_session"; // atletas
export const SESSION_DAYS = 7;
export const ATHLETE_SESSION_DAYS = 30;

const key = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET no configurado (mínimo 32 caracteres)");
  return new TextEncoder().encode(secret);
};

export async function signSession(subjectId: string, role: Role = "admin"): Promise<string> {
  return new SignJWT({ typ: role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(subjectId)
    .setIssuedAt()
    .setExpirationTime(`${role === "admin" ? SESSION_DAYS : ATHLETE_SESSION_DAYS}d`)
    .sign(key());
}

/** Devuelve el id si el token es válido, no expiró y es del tipo pedido. */
export async function readSession(token: string | undefined, role: Role = "admin"): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    // Las sesiones de admin anteriores a este cambio no traen "typ": se aceptan como admin.
    const typ = payload.typ ?? "admin";
    if (typ !== role) return null;
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
