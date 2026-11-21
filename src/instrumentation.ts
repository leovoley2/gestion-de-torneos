import type { Instrumentation } from "next";

// Next.js llama a onRequestError cuando falla una página, una ruta o una acción del servidor.
// Se registra el error y se avisa por correo a los administradores generales (lib/error-alerts.ts).
// El import va dentro del `if` con NEXT_RUNTIME para que no se compile para el runtime edge
// (allí no existen node:crypto ni la conexión a la base de datos).
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const e = err as Error & { digest?: string };
    const { reportServerError } = await import("./lib/error-alerts");
    await reportServerError({
      message: e?.message || String(err),
      stack: e?.stack,
      digest: e?.digest,
      route: context.routePath || request.path,
      method: request.method,
      kind: context.routeType,
    });
  }
};
