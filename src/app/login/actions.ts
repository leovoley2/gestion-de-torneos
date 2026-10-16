"use server";

import { redirect } from "next/navigation";
import { login, logout } from "@/lib/auth";
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
