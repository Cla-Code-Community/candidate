import { Queue } from "bullmq";
import IORedis, { type Redis } from "ioredis";
import { getConfig } from "../../config";
import type { TemplateName } from "./templates/registry";

/**
 * Nome da fila BullMQ e do job de envio de e-mail.
 */
export const EMAIL_QUEUE_NAME = "email";
const EMAIL_JOB_NAME = "send-email";

/**
 * Payload do job enfileirado. Efêmero — sem persistência em DB (só na fila).
 */
export interface EmailJobData {
  template: TemplateName;
  to: string;
  data: Record<string, unknown>;
}

let _connection: Redis | null = null;
let _queue: Queue<EmailJobData> | null = null;

/**
 * Conexão ioredis dedicada ao BullMQ, separada do node-redis do cache.
 * `maxRetriesPerRequest: null` é exigido pelo BullMQ.
 */
export function getEmailConnection(): Redis {
  if (_connection) return _connection;

  const { valkeyUrl } = getConfig();
  _connection = new IORedis(valkeyUrl, { maxRetriesPerRequest: null });
  return _connection;
}

/**
 * Singleton lazy da fila `email` sobre Valkey (via ioredis).
 */
export function getEmailQueue(): Queue<EmailJobData> {
  if (_queue) return _queue;

  _queue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
    connection: getEmailConnection(),
  });
  return _queue;
}

/**
 * Enfileira um job de e-mail com retry/backoff configuráveis (EMAIL-01/03).
 */
export async function enqueueEmail(data: EmailJobData): Promise<void> {
  const { emailQueueAttempts } = getConfig();

  await getEmailQueue().add(EMAIL_JOB_NAME, data, {
    attempts: emailQueueAttempts,
    backoff: { type: "exponential", delay: 2000 },
  });
}

/**
 * Fecha a fila e a conexão no graceful shutdown.
 */
export async function closeEmailQueue(): Promise<void> {
  if (_queue) {
    await _queue.close();
    _queue = null;
  }
  if (_connection) {
    await _connection.quit();
    _connection = null;
  }
}
