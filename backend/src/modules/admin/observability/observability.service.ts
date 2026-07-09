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
