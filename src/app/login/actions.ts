"use server";

import { redirect } from "next/navigation";
import { login, logout, setSessionCookie } from "@/lib/auth";
import { SESSION_COOKIE, SESSION_DAYS, signSession } from "@/lib/session";
import { activateWithToken } from "@/lib/staff";
import { safeNext } from "@/lib/safe-redirect";

export type SignInState = { error: string; email: string } | null;

export async function signIn(_: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "");
  const result = await login(email, String(formData.get("password") ?? ""));
  if (result === "locked") {
    return { error: "Demasiados intentos fallidos. Espera 15 minutos y vuelve a intentar.", email };
  }
  if (result === "invalid") return { error: "Correo o contraseña incorrectos", email };
  redirect(safeNext(formData.get("next")));
}

export async function signOut() {
  await logout();
  redirect("/");
}

export type ActivateState = { error: string } | null;

/** Activa el acceso de un miembro del equipo con el enlace de un solo uso. */
export async function activateAccount(_: ActivateState, formData: FormData): Promise<ActivateState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 10) return { error: "La contraseña debe tener al menos 10 caracteres" };
  if (password !== String(formData.get("password2") ?? "")) return { error: "Las contraseñas no coinciden" };
  const adminId = await activateWithToken(String(formData.get("token") ?? ""), password);
  if (!adminId) return { error: "El enlace no es válido o ya venció. Pide uno nuevo al administrador." };
  await setSessionCookie(SESSION_COOKIE, await signSession(adminId, "admin"), SESSION_DAYS);
  redirect("/admin");
}
