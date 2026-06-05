// ============================================================
// Pollon — Cliente de email (Resend)
// ============================================================

import { Resend } from "resend";

const FROM = "Pollon <noreply@pollon.app>"; // ajustar al dominio verificado en Resend

function getClient(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY no configurada");
  return new Resend(key);
}

export interface ReminderEmail {
  to: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  matchUrl: string;
}

/** Envía un recordatorio de cierre de predicción. No-op si RESEND_API_KEY no está configurada. */
export async function sendReminderEmail(email: ReminderEmail): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  const resend = getClient();
  const kickoff = new Date(email.kickoffAt).toLocaleString("es", {
    dateStyle: "full",
    timeStyle: "short",
  });

  await resend.emails.send({
    from: FROM,
    to: email.to,
    subject: `⏰ No olvides predecir: ${email.homeTeam} vs ${email.awayTeam}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px;">
        <h2>Tu predicción cierra pronto</h2>
        <p>El partido <strong>${email.homeTeam} vs ${email.awayTeam}</strong>
        comienza el ${kickoff}. Las predicciones cierran 24 horas antes.</p>
        <p><a href="${email.matchUrl}"
          style="display:inline-block;padding:10px 18px;background:#111;color:#fff;border-radius:8px;text-decoration:none;">
          Hacer mi predicción
        </a></p>
      </div>
    `,
  });
}
