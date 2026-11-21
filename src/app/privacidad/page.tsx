import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/Brand";
import { CONSENT_AGE, POLICY_DATE_LABEL, RESPONSIBLE } from "@/lib/legal";

export const metadata = {
  title: "Política de privacidad · Vóley Playa",
  description: "Cómo tratamos los datos personales de atletas y apoderados en la plataforma de torneos.",
};

const mail = RESPONSIBLE.privacyEmail;

export default function PrivacyPolicy() {
  return (
    <>
      <SiteHeader>
        <p className="eyebrow text-sky-300">Legal</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Política de privacidad</h1>
        <p className="mt-2 text-sky-100/80">Vigente desde el {POLICY_DATE_LABEL}</p>
      </SiteHeader>

      <main className="mx-auto -mt-6 max-w-3xl px-4 sm:px-6">
        <article className="card space-y-8 text-[15px] leading-relaxed text-navy-700 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-navy-900 [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5">
          <section className="space-y-2">
            <p>
              Esta política explica qué datos personales recogemos en {RESPONSIBLE.site} (la “plataforma”), para qué los
              usamos, con quién los compartimos y cómo puedes ejercer tus derechos, conforme a la Ley N.° 29733, Ley de
              Protección de Datos Personales, y su Reglamento (Decreto Supremo N.° 016-2024-JUS).
            </p>
          </section>

          <section className="space-y-2">
            <h2>1. Responsable del tratamiento</h2>
            <ul>
              <li>
                <strong>{RESPONSIBLE.name}</strong> · RUC {RESPONSIBLE.ruc}
              </li>
              <li>Domicilio: {RESPONSIBLE.address}</li>
              <li>
                Contacto para temas de datos personales: <a href={`mailto:${mail}`} className="text-sky-700 underline">{mail}</a>
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2>2. Qué datos recogemos</h2>
            <ul>
              <li>
                <strong>Cuenta de atleta:</strong> nombres, apellidos, correo electrónico y contraseña (guardada cifrada; nadie
                puede verla).
              </li>
              <li>
                <strong>Perfil:</strong> tipo y número de documento, fecha de nacimiento, sexo, teléfono, ciudad y club.
              </li>
              <li>
                <strong>Menores de edad:</strong> nombre, documento, teléfono y parentesco del padre, madre o apoderado, y la
                declaración jurada firmada (archivo PDF) que se pide para inscribirlos.
              </li>
              <li>
                <strong>Pagos:</strong> el comprobante de pago de la inscripción (captura de Yape o foto/PDF de la
                transferencia) y si la organización confirmó el pago. No guardamos datos de tarjetas ni de cuentas
                bancarias.
              </li>
              <li>
                <strong>Actividad deportiva:</strong> inscripciones, duplas, horarios, resultados, posiciones finales y puntos
                de ranking.
              </li>
              <li>
                <strong>Datos técnicos:</strong> la dirección IP desde la que se crea la cuenta y los intentos de ingreso
                (para evitar accesos indebidos), y una cookie de sesión necesaria para mantenerte conectado. No usamos
                cookies de publicidad ni de analítica.
              </li>
              <li>
                La organización también puede registrar a atletas sin cuenta (solo nombre y, si hace falta, documento) para
                cargar duplas y resultados.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2>3. Para qué los usamos</h2>
            <ul>
              <li>Crear y administrar tu cuenta, y enviarte los correos necesarios (confirmación, contraseña, inscripciones).</li>
              <li>Gestionar inscripciones, verificar la edad y categoría, y armar duplas, grupos y llaves.</li>
              <li>Verificar el pago de las inscripciones.</li>
              <li>Publicar resultados, posiciones y el ranking del circuito.</li>
              <li>Contactarte o contactar a tu apoderado por temas del torneo.</li>
              <li>Proteger la plataforma frente a accesos indebidos.</li>
            </ul>
            <p>
              No vendemos tus datos ni los usamos para publicidad. Tampoco tomamos decisiones automatizadas sobre ti más allá
              de los cálculos de posiciones y ranking según el reglamento del torneo.
            </p>
          </section>

          <section className="space-y-2">
            <h2>4. Qué se publica</h2>
            <p>
              Los torneos son eventos públicos. En la web se publican tu <strong>nombre, club, ciudad</strong>, las duplas que
              integras, horarios, resultados, posiciones y puntos de ranking, y una página de perfil con ese historial.
              <strong> Nunca</strong> se publican tu documento, fecha de nacimiento, correo, teléfono ni los datos de tu
              apoderado.
            </p>
          </section>

          <section className="space-y-2">
            <h2>5. Base legal y consentimiento</h2>
            <p>
              Tratamos tus datos con tu consentimiento, que das al crear tu cuenta, y porque son necesarios para gestionar tu
              participación en los torneos que solicitas. Puedes retirar tu consentimiento en cualquier momento (ver punto 9),
              lo que implica dejar de usar la cuenta.
            </p>
          </section>

          <section className="space-y-2">
            <h2>6. Menores de edad</h2>
            <p>
              Para los menores de {CONSENT_AGE} años, el tratamiento de sus datos requiere la autorización de su padre, madre
              o apoderado, que debe crear o completar la cuenta junto con el menor y dar su autorización en el perfil. Para
              los menores de 18 años, además, se pide la declaración jurada firmada por el apoderado para cada inscripción.
            </p>
          </section>

          <section className="space-y-2">
            <h2>7. Con quién compartimos los datos</h2>
            <p>
              Solo con el equipo de la organización que gestiona cada torneo (con accesos según su rol) y con proveedores
              que nos prestan servicios tecnológicos, que tratan los datos únicamente por encargo nuestro:
            </p>
            <ul>
              <li>Vercel Inc. (alojamiento de la web y almacenamiento de archivos) — Estados Unidos.</li>
              <li>Neon Inc. (base de datos) — Estados Unidos.</li>
              <li>Resend (envío de correos) — servidores en Brasil; empresa en Estados Unidos.</li>
            </ul>
            <p>
              Esto implica una transferencia internacional de datos, que se realiza con proveedores que aplican medidas de
              seguridad adecuadas. También podríamos entregar datos a autoridades cuando la ley lo exija.
            </p>
          </section>

          <section className="space-y-2">
            <h2>8. Cuánto tiempo los guardamos</h2>
            <ul>
              <li>Los datos de tu cuenta y perfil, mientras la cuenta exista.</li>
              <li>
                Los resultados, posiciones y ranking se conservan como registro histórico de las competencias, incluso si
                eliminas tu cuenta (con tu nombre tal como figuró en el torneo).
              </li>
              <li>Las declaraciones juradas y los comprobantes de pago, mientras la cuenta exista; se borran al eliminarla.</li>
              <li>Los intentos de ingreso, un día.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2>9. Tus derechos</h2>
            <p>
              Puedes ejercer tus derechos de <strong>información, acceso, rectificación, cancelación (supresión) y
              oposición</strong>:
            </p>
            <ul>
              <li>
                <strong>Corregir</strong> tus datos cuando quieras desde{" "}
                <Link href="/cuenta/perfil" className="text-sky-700 underline">
                  Mi cuenta → Perfil
                </Link>
                .
              </li>
              <li>
                <strong>Eliminar tu cuenta</strong> desde el mismo perfil, al final de la página.
              </li>
              <li>
                Para cualquier otro pedido (por ejemplo, saber qué datos tenemos de ti, u oponerte a que se publique tu
                perfil), escribe a <a href={`mailto:${mail}`} className="text-sky-700 underline">{mail}</a> desde el correo
                de tu cuenta o adjuntando tu documento. Responderemos dentro de los plazos que fija la ley.
              </li>
            </ul>
            <p>
              Si consideras que no atendimos tu pedido, puedes presentar una reclamación ante la Autoridad Nacional de
              Protección de Datos Personales del Ministerio de Justicia y Derechos Humanos.
            </p>
          </section>

          <section className="space-y-2">
            <h2>10. Seguridad</h2>
            <p>
              Las contraseñas se guardan cifradas, las conexiones usan HTTPS, las declaraciones juradas se guardan en un
              almacenamiento privado al que solo accede el equipo autorizado, y el acceso del equipo de la organización está
              limitado por roles. Ningún sistema es infalible: si ocurriera un incidente que afecte tus datos, te
              informaremos.
            </p>
          </section>

          <section className="space-y-2">
            <h2>11. Cambios en esta política</h2>
            <p>
              Si cambiamos esta política de forma importante, te lo avisaremos en la plataforma y te pediremos aceptarla de
              nuevo. La fecha de la versión vigente figura al inicio.
            </p>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
