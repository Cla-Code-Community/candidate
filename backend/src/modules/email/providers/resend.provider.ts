import { Resend } from "resend";
import { getConfig } from "../../../config";
import { logError } from "../../../logger";
import { MailMessage, MailProvider } from "./mail-provider";

/**
 * Provedor concreto baseado na Resend. Envia o e-mail já renderizado.
 * Em caso de falha da API, lança para que o BullMQ re-tente (EMAIL-02/03).
 */
export class ResendProvider implements MailProvider {
  async send(msg: MailMessage): Promise<void> {
    const { emailApiKey, emailFromAddress, emailFromName } = getConfig();
    const resend = new Resend(emailApiKey);
    const from = `${emailFromName} <${emailFromAddress}>`;

    const response = await resend.emails.send({
      from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      replyTo: msg.replyTo,
    });

    if (response.error) {
      logError("Falha ao enviar e-mail pela Resend.", {
        to: msg.to,
        subject: msg.subject,
        error: response.error.message,
      });
      throw new Error(response.error.message);
    }
  }
}
