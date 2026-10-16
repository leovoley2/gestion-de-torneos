# Torneos Vóley Playa – web

Next.js (App Router, TypeScript, Tailwind) + Postgres ([Neon](https://neon.tech) en producción, Docker en local).

## Correr en local

Requiere **Docker Desktop** abierto. Si `docker` no se encuentra: `export PATH="$HOME/.docker/bin:$PATH"`.

```bash
npm install
cp .env.example .env.local   # completar DATABASE_URL y AUTH_SECRET
docker run -d --name torneos-db -e POSTGRES_USER=torneos -e POSTGRES_PASSWORD=torneos \
  -e POSTGRES_DB=torneos -p 5433:5432 -v torneos-db-data:/var/lib/postgresql/data postgres:17-alpine
npm run db:migrate           # aplica db/migrations/*.sql
npm run admin:create         # admin de prueba (LOCAL_ADMIN_EMAIL / LOCAL_ADMIN_PASSWORD)
npm run dev                  # http://localhost:3000
npm test                     # motor de formatos + permisos de administrador
```

Si el contenedor ya existe: `docker start torneos-db`.

## Producción con Neon

La configuración de producción está en `.env.production.local` (privado, fuera de git):
`DATABASE_URL` (cadena **pooled** de Neon), `AUTH_SECRET` y el primer administrador.

```bash
npm run db:migrate:prod                                      # aplica migraciones en Neon
npm run admin:create:prod -- correo@ejemplo.com 'contraseña' # crea admin o cambia su contraseña
npm run build && npx next start                              # prueba local contra Neon
```

En el hosting (Vercel/Netlify) se cargan las mismas variables `DATABASE_URL` y `AUTH_SECRET`.

## Seguridad

- La base de datos solo la conoce el servidor (`DATABASE_URL` nunca llega al navegador).
- Las páginas públicas solo leen torneos **publicados**; un borrador responde 404 aunque se conozca el enlace.
- Toda escritura pasa por `src/app/admin/actions.ts`, y cada acción empieza con `requireAdmin()`.
  `actions.test.ts` llama a **todas** las acciones sin sesión, con una cookie falsificada y con la sesión
  de un admin borrado, y verifica que fallen sin tocar la base de datos.
- Contraseñas con scrypt; sesión en cookie `httpOnly` firmada (HS256, 7 días). Borrar un admin revoca su sesión.
- No hay registro público: los administradores se crean con `npm run admin:create`.

| | Visitante / atleta (sin login) | Administrador |
|---|---|---|
| Ver torneos publicados: duplas, programación, resultados, grupos y llaves | ✅ (se actualiza cada 10 s) | ✅ |
| Ver borradores | ❌ | ✅ |
| Crear/editar torneos, duplas, formato, resultados, programación | ❌ | ✅ |

## Rutas

- `/` torneos publicados · `/torneos/[id]` categorías · `/torneos/[id]/[categoría]` partidos, grupos/llaves y duplas
- `/login` · `/admin` panel (torneos → categorías → duplas, formato, resultados y programación)
- `/formatos` laboratorio de formatos con resultados simulados

## Motor de formatos (`src/lib/engine`)

TypeScript puro, sin dependencias de base de datos ni de UI. Diseño en `../DISENO_FORMATOS.md`.

| Archivo | Qué hace |
|---|---|
| `types.ts` | Fases, orígenes de equipos (`Source`), reglas, estado |
| `templates.ts` | Plantillas: grupos+llave, pools FIVB, doble eliminación, cruces… |
| `generate.ts` | Definición → grupos y partidos numerados |
| `groupStage.ts` / `elimination.ts` | Generadores (todos contra todos, pool FIVB, llave simple con byes, doble eliminación) |
| `resolve.ts` | Resultados → equipos de cada partido, posiciones, clasificados, podio |
| `standings.ts` / `score.ts` | Tabla con desempates en cascada; validación de marcador FIVB |
| `simulate.ts` | Resultados aleatorios válidos (pruebas y demo) |
