// Enlaces para compartir por WhatsApp (sin número: el atleta elige a quién mandarlo en su WhatsApp,
// así la app no expone el teléfono del compañero).

/** Mensaje para avisar al compañero que tiene una invitación de dupla esperando. */
export function inviteMessage(o: { partnerFirstName: string; tournament: string; category: string; url: string }): string {
  const hola = o.partnerFirstName ? `¡Hola ${o.partnerFirstName}!` : "¡Hola!";
  return `${hola} Te invité a jugar juntos en ${o.tournament} · ${o.category} 🏐\nEntra con tu cuenta y acepta la invitación aquí: ${o.url}`;
}

/** https://wa.me/?text=… abre WhatsApp (app o web) con el mensaje listo para elegir el contacto. */
export const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
