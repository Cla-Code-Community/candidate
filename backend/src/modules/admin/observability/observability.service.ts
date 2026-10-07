import { config } from "../../../config";
import { ProcessorSnapshotSchema } from "./observability.types";
import { HealthService } from "./health.service";
import { MetricsService } from "./metrics.service";
import type {
  HealthcheckResult,
  MetricSnapshot,
  ObservabilityDashboards,
  ObservabilityOverview,
} from "./observability.types";

export class ObservabilityService {
  constructor(
    private readonly healthService: HealthService,
    private readonly metricsService: MetricsService,
  ) {}

  async getOperationalSnapshot() {
    const timestamp = new Date().toISOString();
    try {
      const response = await fetch(`${config.scraperUrl}/admin/observability`, {
        signal: AbortSignal.timeout(2500),
      });
      if (!response.ok) throw new Error("processor unavailable");
      const processor = ProcessorSnapshotSchema.parse(await response.json());
      return {
        status: processor.status,
        timestamp,
        processor,
        availability: { scraper: "ok" as const },
      };
    } catch {
      // Dependency failure is distinct from an available Processor with no runs.
      return {
        status: "partial" as const,
        timestamp,
        processor: null,
        availability: { scraper: "down" as const },
      };
    }
  }

  async getHealth(): Promise<HealthcheckResult> {
    return this.healthService.getHealthcheck();
  }

  async getMetrics(): Promise<MetricSnapshot> {
    return this.metricsService.getSnapshot();
  }

  async getDashboards(range?: string): Promise<ObservabilityDashboards> {
    return this.metricsService.getDashboards(range);
  }

  async getOverview(): Promise<ObservabilityOverview> {
    const [health, metrics] = await Promise.all([
      this.healthService.getHealthcheck(),
      this.metricsService.getSnapshot(),
    ]);
    return { health, metrics };
  }
}
