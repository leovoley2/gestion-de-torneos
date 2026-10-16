"use server";

import { redirect } from "next/navigation";
import { login, logout } from "@/lib/auth";

export type SignInState = { error: string; email: string } | null;

export async function signIn(_: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "");
  const ok = await login(email, String(formData.get("password") ?? ""));
  if (!ok) return { error: "Correo o contraseña incorrectos", email };
  const next = String(formData.get("next") ?? "/admin");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/admin");
}

export async function signOut() {
  await logout();
  redirect("/");
}
