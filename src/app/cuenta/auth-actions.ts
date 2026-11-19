"use server";

import { redirect } from "next/navigation";
import {
  athleteLogin,
  athleteLogout,
  requestPasswordReset,
  resetPassword,
  signup,
} from "@/lib/athlete-auth";
import { safeNext } from "@/lib/safe-redirect";

// Acciones públicas de la cuenta (no requieren sesión): registrarse, ingresar y recuperar acceso.

export type FormState = { error?: string; ok?: string; values?: Record<string, string> } | null;
const field = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function signUpAction(_: FormState, fd: FormData): Promise<FormState> {
  const values = { email: field(fd, "email"), firstName: field(fd, "firstName"), lastName: field(fd, "lastName") };
  const r = await signup({ ...values, password: field(fd, "password") });
  if (!r.ok) return { error: r.error, values };
  redirect(safeNext(fd.get("next"), "/cuenta/perfil", "/cuenta"));
}

export async function signInAction(_: FormState, fd: FormData): Promise<FormState> {
  const email = field(fd, "email");
  const r = await athleteLogin(email, field(fd, "password"));
  if (r === "locked") return { error: "Demasiados intentos fallidos. Espera 15 minutos y vuelve a intentar.", values: { email } };
  if (r === "invalid") return { error: "Correo o contraseña incorrectos", values: { email } };
  redirect(safeNext(fd.get("next"), "/cuenta", "/cuenta"));
}

export async function forgotPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  await requestPasswordReset(field(fd, "email"));
  return { ok: "Si existe una cuenta con ese correo, te enviamos un enlace para elegir una nueva contraseña." };
}

export async function resetPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const password = field(fd, "password");
  if (password !== field(fd, "password2")) return { error: "Las contraseñas no coinciden" };
  const r = await resetPassword(field(fd, "token"), password);
  if (!r.ok) return { error: r.error };
  redirect("/cuenta");
}

export async function signOutAction() {
  await athleteLogout();
  redirect("/");
}
