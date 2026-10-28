// Envío de correos (códigos para confirmar la cuenta). Con SMTP_URL se envían de verdad;
// sin él (por ejemplo, al desarrollar) el código se muestra en la consola del servidor.

import nodemailer from "nodemailer";

const smtp = process.env.SMTP_URL;
const from = process.env.MAIL_FROM ?? "MyConferences <no-reply@myconferences.app>";
const transport = smtp ? nodemailer.createTransport(smtp) : null;

if (!transport) console.log("[correo] Sin SMTP_URL: los códigos para confirmar cuentas se muestran en esta consola.");

export async function sendCode(to: string, name: string, code: string) {
  const subject = `${code} es tu código de MyConferences`;
  const text = `Hola, ${name}:\n\nTu código para confirmar tu correo en MyConferences es ${code}.\nVence en 15 minutos.\n\nSi no creaste una cuenta, ignora este mensaje.`;
  if (!transport) {
    console.log(`[correo] Código para ${to}: ${code}`);
    return;
  }
  await transport.sendMail({ from, to, subject, text });
}
