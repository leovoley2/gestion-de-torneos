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
npm run admin:create:prod -- correo@ejemplo.com           # crea admin o cambia su contraseña (la pide oculta)
npm run build && npx next start                              # prueba local contra Neon
```

En el hosting (Vercel/Netlify) se cargan las mismas variables `DATABASE_URL` y `AUTH_SECRET`.

## Seguridad

- La base de datos solo la conoce el servidor (`DATABASE_URL` nunca llega al navegador).
- Las páginas públicas solo leen torneos **publicados**; un borrador responde 404 aunque se conozca el enlace.
- Escrituras de la organización: `src/app/admin/*actions.ts`, cada acción empieza con `requireAdmin()`.
  Escrituras de atletas: `src/app/cuenta/actions.ts`, cada acción exige sesión de atleta y solo toca sus datos.
  Las sesiones de atleta y de administrador son cookies distintas con tipo firmado: una no sirve por la otra.
  `actions.test.ts` llama a **todas** las acciones sin sesión, con una cookie falsificada y con la sesión
  de un admin borrado, y verifica que fallen sin tocar la base de datos.
- Contraseñas con scrypt; sesión en cookie `httpOnly` firmada (HS256, 7 días). Borrar un admin revoca su sesión.
- Los administradores no se registran solos: se crean con `npm run admin:create`. Los atletas sí crean su cuenta.

| | Visitante (sin login) | Atleta con cuenta | Administrador |
|---|---|---|---|
| Ver torneos publicados: duplas, programación, resultados, grupos y llaves | ✅ (se actualiza cada 10 s) | ✅ | ✅ |
| Ver borradores | ❌ | ❌ | ✅ |
| Editar su perfil, inscribirse con su dupla, subir su declaración jurada | ❌ | ✅ (solo lo suyo) | — |
| Aceptar o rechazar inscripciones, ver PDFs de menores | ❌ | ❌ (solo su propio PDF) | ✅ |
| Crear/editar torneos, duplas, formato, resultados, programación | ❌ | ❌ | ✅ |

## Cuentas de atletas e inscripciones

- Los atletas crean su cuenta en `/cuenta/registro`, completan su perfil y se inscriben con su dupla:
  uno invita (por correo o documento) y el compañero confirma desde su cuenta.
- Menores de 18 años (a la fecha del torneo): el perfil pide los datos del apoderado y cada inscripción
  exige la declaración jurada en PDF (máx. 5 MB, se valida que sea un PDF real).
- La organización abre/cierra inscripciones por categoría (plazo, cupo, años de nacimiento) y acepta o
  rechaza cada dupla. Al aceptar, la dupla entra a la lista de la categoría.
- Reglas que se verifican: rama (F/M/mixta), años de nacimiento, perfil completo, sin inscripciones
  duplicadas en la categoría y declaraciones de menores.

### Variables de entorno adicionales

| Variable | Para qué | Sin configurar |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | PDFs en Vercel Blob privado (ya conectado en Vercel) | se guardan en `web/.uploads/` (solo desarrollo) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Envío de correos (requiere dominio propio verificado en Resend) | los correos se guardan en `email_outbox`; en desarrollo se ven en `/dev/correos`. No se exige confirmar el correo y la organización genera enlaces de contraseña desde `/admin/atletas` |
| `APP_URL` | URL base de los enlaces en correos | usa la URL de Vercel o `http://localhost:3000` |

## Equipo de la organización y roles

| Rol | Puede |
|---|---|
| Administrador general | Todo, incluido el equipo (`/admin/equipo`), rankings y tablas de puntos (`/admin/ranking`), unir fichas con cuentas |
| Organizador | Torneos, categorías, duplas, formato, inscripciones, resultados y posiciones finales |
| Mesa de resultados | Solo resultados y programación |
| Inscripciones | Revisar inscripciones y atender a los atletas |

Cada rol vale para todos los torneos o solo para uno. Para dar acceso se genera un enlace de activación
(72 h) que la persona usa para elegir su contraseña. `src/lib/permissions.ts` define qué permite cada rol;
`roles.test.ts` verifica que un rol limitado solo pueda usar sus acciones.

## Ranking del circuito

- Rankings por rama y temporada; cada categoría indica a qué ranking suma y con qué tabla de puntos.
- Al terminar una categoría se calculan las posiciones finales (`engine/final-standings.ts`): podio desde la
  última fase; el resto por ronda de eliminación (empatados comparten puesto) o puesto en el grupo.
  La organización puede corregir posiciones a mano.
- Puntos de la dupla según la tabla (empates: promedio de los puestos que ocupan), **divididos por la mitad**
  entre sus dos jugadores. El ranking individual suma todo lo de la temporada y se recalcula solo.
- Puntos de una dupla nueva = suma de los puntos de sus dos jugadores → botón "Ordenar por ranking" (siembra).
- Duplas cargadas a mano se arman con atletas existentes o fichas sin cuenta; si el jugador se registra
  después, el administrador general une la ficha con su cuenta y conserva sus puntos.

## Rutas

- `/` torneos publicados · `/torneos/[id]` categorías (botón "Inscribirme" si están abiertas) · `/torneos/[id]/[categoría]`
- `/ranking` rankings publicados · `/ranking/[id]` ranking individual con el detalle de puntos
- `/cuenta` área del atleta: perfil, inscripciones, invitaciones, declaración jurada
- `/login` · `/login/activar` (enlace de acceso del equipo) · `/admin` panel: torneos → categorías → inscripciones,
  duplas, formato, resultados, ranking y posiciones · `/admin/atletas` · `/admin/ranking` · `/admin/equipo`
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
