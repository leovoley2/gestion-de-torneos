// Crea un administrador o cambia su contraseña. Uso:
//   node --env-file=.env.local scripts/create-admin.mjs correo@ejemplo.com 'contraseña'
// Sin argumentos usa LOCAL_ADMIN_EMAIL / LOCAL_ADMIN_PASSWORD de .env.local.
import postgres from "postgres";
import { hashPassword } from "../src/lib/password.ts";

const email = (process.argv[2] ?? process.env.LOCAL_ADMIN_EMAIL ?? "").trim().toLowerCase();
const password = process.argv[3] ?? process.env.LOCAL_ADMIN_PASSWORD;
if (!process.env.DATABASE_URL || !email || !password) {
  console.error("Faltan DATABASE_URL, correo o contraseña");
  process.exit(1);
}
if (password.length < 10) {
  console.error("La contraseña debe tener al menos 10 caracteres");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
await sql`
  insert into admins (email, password_hash) values (${email}, ${await hashPassword(password)})
  on conflict (email) do update set password_hash = excluded.password_hash`;
console.log(`Administrador listo: ${email}`);
await sql.end();
