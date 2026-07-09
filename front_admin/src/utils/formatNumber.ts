/**
 * Formata números para o padrão brasileiro (ex: 12458 -> "12.458")
 */
export function formatNumber(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
