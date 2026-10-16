import "server-only";
import postgres from "postgres";

// Una sola conexión compartida (en desarrollo sobrevive a las recargas de Next).
const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

export const sql =
  globalForDb.sql ??
  postgres(process.env.DATABASE_URL!, {
    // El pooler de Neon (PgBouncer en modo transacción) no admite sentencias preparadas.
    prepare: false,
    max: 5,
    idle_timeout: 20,
    onnotice: () => {},
    // Las columnas "date" se devuelven como texto AAAA-MM-DD (sin desfase de zona horaria).
    types: { date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x } },
  });

if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;
