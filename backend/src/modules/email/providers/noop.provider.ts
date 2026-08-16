import { logWarn } from "../../../logger";
import { MailMessage, MailProvider } from "./mail-provider";

/**
 * Provedor de fallback usado quando nenhuma credencial de e-mail está
 * configurada. Loga um aviso e trata o envio como no-op, sem lançar,
 * para não derrubar o boot nem o fluxo de negócio (EMAIL-09).
 */
export class NoopProvider implements MailProvider {
  async send(msg: MailMessage): Promise<void> {
    logWarn("E-mail desabilitado: nenhum provedor configurado.", {
      to: msg.to,
      subject: msg.subject,
    });
  }
}
