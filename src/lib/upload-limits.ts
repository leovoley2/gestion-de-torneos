// Tamaño máximo de los archivos que suben los atletas (comprobantes y declaraciones juradas).
// 4.000.000 bytes deja margen dentro del límite de 4 MB de las acciones del servidor (next.config.ts)
// y del máximo de 4,5 MB por solicitud de Vercel. Se usa en el servidor y en el navegador.
export const MAX_UPLOAD_BYTES = 4_000_000;
export const MAX_UPLOAD_LABEL = "4 MB";
export const tooBigMessage = (bytes: number) =>
  `El archivo pesa ${(bytes / 1_000_000).toFixed(1)} MB; el máximo es ${MAX_UPLOAD_LABEL}. Envía una captura de pantalla o una foto más liviana.`;
