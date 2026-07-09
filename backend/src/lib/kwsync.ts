import type { RedisClientType } from "redis";
import { logger } from "../logger";

// Chave absoluta global. O Go lerá exatamente esse namespace.
const PENDING_KEY = "scraper:keywords:pending";

export interface KeywordEvent {
  keyword: string;
  source: "user" | "scraper";
  createdAt: string;
  userId?: string;
}

/**
 * Enfileira uma única palavra-chave para o Go processar.
 * Não lança exceções — erros são apenas logados para não travar o fluxo HTTP do usuário.
 */
export async function publish(
  client: RedisClientType,
  keyword: string,
  source: KeywordEvent["source"] = "user",
  userId?: string,
): Promise<void> {
  const event: KeywordEvent = {
    keyword,
    source,
    createdAt: new Date().toISOString(),
    ...(userId ? { userId } : {}),
  };

  try {
    // Usando o cliente bruto conectado ao Valkey para injetar na fila absoluta do scraper
    await client.lPush(PENDING_KEY, JSON.stringify(event));
    logger.info(
      { keyword, source, userId },
      "kwsync: keyword enfileirada com sucesso",
    );
  } catch (err) {
    logger.error(
      { err, keyword },
      "kwsync: falha crítica ao enfileirar keyword",
    );
  }
}

/**
 * Enfileira múltiplas palavras-chave de uma única vez (Batch).
 * Altamente performático: faz apenas uma viagem de rede (Roundtrip) até o Valkey.
 */
export async function publishBatch(
  client: RedisClientType,
  keywords: string[],
  source: KeywordEvent["source"] = "user",
): Promise<void> {
  if (keywords.length === 0) return;

  const now = new Date().toISOString();
  const payloads = keywords.map((keyword) =>
    JSON.stringify({ keyword, source, createdAt: now } satisfies KeywordEvent),
  );

  try {
    // Envia o array de payloads em uma única chamada atômica
    await client.lPush(PENDING_KEY, payloads);
    logger.info(
      { count: keywords.length, source },
      "kwsync: lote (batch) de keywords enfileirado com sucesso",
    );
  } catch (err) {
    logger.error(
      { err },
      "kwsync: falha crítica ao enfileirar lote de keywords",
    );
  }
}
