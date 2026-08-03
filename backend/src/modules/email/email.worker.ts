import { type Job, Worker } from "bullmq";
import { logError, logInfo } from "../../logger";
import {
  EMAIL_QUEUE_NAME,
  type EmailJobData,
  getEmailConnection,
} from "./email.queue";
import { getMailProvider } from "./providers/mail-provider";
import { renderTemplate } from "./templates/registry";

let _worker: Worker<EmailJobData> | null = null;

/**
 * Processa um job: renderiza o template e despacha via provider.
 * Um erro do provider é propagado para que o BullMQ re-tente (EMAIL-02/03).
 */
async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { template, to, data } = job.data;

  const { subject, html } = await renderTemplate(
    template,
    data as never,
  );

  await getMailProvider().send({ to, subject, html });
}

/**
 * Cria o worker in-process que consome a fila `email`. Chamado no boot.
 */
export function startEmailWorker(): Worker<EmailJobData> {
  if (_worker) return _worker;

  _worker = new Worker<EmailJobData>(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: getEmailConnection(),
  });

  // Fracasso final após esgotar os retries: apenas loga (EMAIL-03).
  _worker.on("failed", (job, err) => {
    logError("Falha no envio de e-mail após retries.", {
      jobId: job?.id,
      to: job?.data?.to,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  logInfo("Email worker iniciado.");
  return _worker;
}

/**
 * Fecha o worker no graceful shutdown.
 */
export async function stopEmailWorker(): Promise<void> {
  if (_worker) {
    await _worker.close();
    _worker = null;
  }
}
