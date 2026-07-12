import type {
  InfraUsage,
  ObservabilityMetric,
} from "../schemas/observability.schemas";

export const MOCK_METRICS: ObservabilityMetric[] = [
  {
    label: "Latência Média da API",
    value: "42ms",
    note: "✔ Excelente (Abaixo do SLA limite de 150ms)",
    tone: "success",
  },
  {
    label: "Taxa de Sucesso de Requisições",
    value: "99.98%",
    note: "✔ Normal",
    tone: "success",
  },
  {
    label: "Erros de Scraping (Última hora)",
    value: "12",
    note: "⚠ Atenção aos timeouts ocasionais no LinkedIn",
    tone: "warning",
  },
];

export const MOCK_INFRA_USAGE: InfraUsage[] = [
  {
    label: "Uso do Pool de Conexões do PostgreSQL",
    valueLabel: "32 / 100 Conexões",
    percentage: 32,
    color: "bg-blue-500",
  },
  {
    label: "Uso de Cache Valkey (Redis)",
    valueLabel: "1.2 GB / 4.0 GB",
    percentage: 30,
    color: "bg-purple-500",
  },
];
