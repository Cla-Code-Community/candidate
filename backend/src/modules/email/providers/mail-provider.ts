import { getConfig } from "../../../config";
import { NoopProvider } from "./noop.provider";
import { ResendProvider } from "./resend.provider";

/**
 * Mensagem já renderizada, pronta para despacho pelo provedor.
 */
export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

/**
 * Contrato de envio. Desacopla o provedor concreto (Resend, no-op, ...)
 * dos callers e do worker.
 */
export interface MailProvider {
  send(msg: MailMessage): Promise<void>;
}

/**
 * Seleciona o provedor com base na configuração:
 * - `EMAIL_API_KEY` presente => ResendProvider (envia de verdade).
 * - `EMAIL_API_KEY` vazio     => NoopProvider (apenas loga; EMAIL-09).
 */
export function getMailProvider(): MailProvider {
  const { emailApiKey } = getConfig();
  return emailApiKey ? new ResendProvider() : new NoopProvider();
}
