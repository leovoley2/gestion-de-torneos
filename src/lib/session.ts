import { SignJWT, jwtVerify } from "jose";

// Firma y verificación de la sesión. Sin dependencias de Node: lo usa también el middleware.
export const SESSION_COOKIE = "torneos_session";
export const SESSION_DAYS = 7;

const key = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET no configurado (mínimo 32 caracteres)");
  return new TextEncoder().encode(secret);
};

export async function signSession(adminId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(adminId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key());
}

/** Devuelve el id del admin si el token es válido y no expiró. */
export async function readSession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
