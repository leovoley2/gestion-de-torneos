import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Comprobantes de pago y declaraciones juradas (fotos/PDF) se suben por acciones del servidor.
    // Next limita esas solicitudes a 1 MB por defecto; Vercel acepta hasta 4,5 MB por solicitud.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
