// Crea un administrador o cambia su contraseña. Uso:
//   npm run admin:create -- correo@ejemplo.com          (local: pide la contraseña sin mostrarla)
//   npm run admin:create:prod -- correo@ejemplo.com     (producción / Neon)
// También acepta la contraseña como segundo argumento (scripts automáticos). Sin correo usa
// LOCAL_ADMIN_EMAIL / LOCAL_ADMIN_PASSWORD de .env.local (admin de prueba local).
import postgres from "postgres";
import { hashPassword } from "../src/lib/password.ts";

/** Lee una línea sin mostrar lo que se escribe. */
function askHidden(question) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) return reject(new Error("Pasa la contraseña como argumento o ejecuta en una terminal"));
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (ch) => {
      for (const c of ch) {
        if (c === "\r" || c === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          return resolve(value);
        }
        if (c === "\u0003") {
          stdout.write("\n");
          process.exit(130); // Ctrl-C
        }
        if (c === "\u007f" || c === "\b") value = value.slice(0, -1);
        else value += c;
      }
    };
    stdin.on("data", onData);
  });
}

const argEmail = process.argv[2];
const email = (argEmail ?? process.env.LOCAL_ADMIN_EMAIL ?? "").trim().toLowerCase();
let password = process.argv[3] ?? (argEmail ? undefined : process.env.LOCAL_ADMIN_PASSWORD);

if (!process.env.DATABASE_URL || !email) {
  console.error("Faltan DATABASE_URL o el correo");
  process.exit(1);
}

if (!password) {
  if (!process.stdin.isTTY) {
    console.error("Pasa la contraseña como argumento o ejecuta el comando en una terminal");
    process.exit(1);
  }
  password = await askHidden(`Nueva contraseña para ${email}: `);
  const again = await askHidden("Repite la contraseña: ");
  if (password !== again) {
    console.error("Las contraseñas no coinciden. No se cambió nada.");
    process.exit(1);
  }
}
if (password.length < 10) {
  console.error("La contraseña debe tener al menos 10 caracteres. No se cambió nada.");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
await sql`
  insert into admins (email, password_hash) values (${email}, ${await hashPassword(password)})
  on conflict (email) do update set password_hash = excluded.password_hash`;
console.log(`Listo: ${email} ya puede ingresar con esa contraseña.`);
await sql.end();
