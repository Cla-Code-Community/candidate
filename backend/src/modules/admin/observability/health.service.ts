import { config } from "../../../config";
import { db } from "../../../db/client";
import { users } from "../../../db/schema/users";
import { cachePing } from "../../../lib/cache";
import type {
  HealthStatus,
  HealthcheckResult,
  ServiceHealth,
} from "./observability.types";

async function checkPostgres(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    await db.select().from(users).limit(1);
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (error) {
    return {
      status: "down",
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function checkValkey(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    await cachePing();
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (error) {
    return {
      status: "down",
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function checkScraper(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const response = await fetch(`${config.scraperUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return {
        status: "degraded",
        latencyMs: Date.now() - start,
        error: `HTTP ${response.status}`,
      };
    }

    return { status: "ok", latencyMs: Date.now() - start };
  } catch (error) {
    return {
      status: "down",
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function aggregateStatus(
  services: Record<string, ServiceHealth>,
): HealthStatus {
  const statuses = Object.values(services).map((s) => s.status);
  if (statuses.includes("down")) return "down";
  if (statuses.includes("degraded")) return "degraded";
  return "ok";
}

export class HealthService {
  async getHealthcheck(): Promise<HealthcheckResult> {
    const [postgres, valkey, scraper] = await Promise.all([
      checkPostgres(),
      checkValkey(),
      checkScraper(),
    ]);

    const services = { postgres, valkey, scraper };

    return {
      status: aggregateStatus(services),
      timestamp: new Date().toISOString(),
      services,
    };
  }
}
