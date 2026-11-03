export function clampPageSize(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(50, Math.max(1, Math.trunc(value)));
}

export function getTotalPages(totalItems: number, pageSize: number) {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

export function getCurrentPage(page: number, totalPages: number) {
  return Math.min(Math.max(1, page), totalPages);
}

export function paginateItems<T>(items: T[], currentPage: number, pageSize: number) {
  const start = (currentPage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
