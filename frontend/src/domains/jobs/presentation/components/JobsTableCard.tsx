import { Badge } from "@/shared/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { cn } from "@/shared/lib/utils";
import type { Job, JobsMeta } from "@/domains/jobs/domain/job.types";
import { useState } from "react";
import {
  FiCheckSquare,
  FiChevronLeft,
  FiChevronRight,
  FiSquare,
} from "react-icons/fi";

interface JobsTableCardProps {
  meta: JobsMeta;
  filteredJobs: Job[];
  paginatedJobs: Job[];
  loading: boolean;
  error: string;
  formatDate: (timestamp: JobsMeta["modifiedAt"]) => string;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

type StatusToggleButtonProps = {
  label: string;
  pressed: boolean;
  activeClassName: string;
  onClick: () => void;
};

type PaginationItem = number | string;

function getResultsLabel(total: number) {
  return `Resultados: ${total} ${total === 1 ? "vaga encontrada" : "vagas encontradas"}`;
}

function getPaginationItems(
  currentPage: number,
  totalPages: number,
): PaginationItem[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, 5];
  }

  if (currentPage >= totalPages - 2) {
    return Array.from({ length: 5 }, (_, index) => totalPages - 4 + index);
  }

  return [
    1,
    "ellipsis-start",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "ellipsis-end",
    totalPages,
  ];
}

function getJobId(job: Job, index: number) {
  return (
    job.link?.trim() ||
    [job.titulo, job.empresa, job.local, String(index)]
      .filter(Boolean)
      .join("|")
  );
}

function getKeywordTags(keywordValue?: string | null) {
  if (!keywordValue) {
    return [];
  }

  return keywordValue
    .split(/[,;|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function StatusToggleButton({
  label,
  pressed,
  activeClassName,
  onClick,
}: StatusToggleButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors",
        pressed ? activeClassName : "text-slate-400 hover:text-[#0c6b35]",
      )}
    >
      {pressed ? (
        <FiCheckSquare className="h-5 w-5" aria-hidden="true" />
      ) : (
        <FiSquare className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  );
}

export function JobsTableCard({
  meta,
  filteredJobs,
  paginatedJobs,
  loading,
  error,
  formatDate,
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: JobsTableCardProps) {
  const [spamMarks, setSpamMarks] = useState<Record<string, boolean>>({});
  const [readMarks, setReadMarks] = useState<Record<string, boolean>>({});
  const resultsLabel = getResultsLabel(filteredJobs.length);
  const paginationItems = getPaginationItems(currentPage, totalPages);

  return (
    <Card className="mb-4 border-border/70 bg-card/90 backdrop-blur dark:bg-card/95">
      <CardHeader>
        <CardTitle className="text-lg">Vagas Encontradas</CardTitle>
        <CardDescription>
          Lista paginada com os resultados mais recentes das buscas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <div className="max-h-[min(34rem,calc(100vh-24rem))] overflow-y-auto rounded-md border border-border/60">
          <Table className="min-w-[900px]">
            <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_hsl(var(--border))]">
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Palavras-chave</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-[0.16em]">
                  Spam
                </TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-[0.16em]">
                  Lido
                </TableHead>
                <TableHead>Fonte</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedJobs.map((job, index) => {
                const jobId = getJobId(job, index);
                const keywords = getKeywordTags(job.palavra);
                const isSpamMarked = Boolean(spamMarks[jobId]);
                const isReadMarked = Boolean(readMarks[jobId]);

                return (
                  <TableRow key={jobId}>
                    <TableCell className="font-medium">
                      {job.link ? (
                        <a
                          href={job.link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline-offset-4 hover:underline dark:text-[#14AE5C]"
                        >
                          {job.titulo || "Abrir vaga"}
                        </a>
                      ) : (
                        job.titulo || "-"
                      )}
                    </TableCell>
                    <TableCell>{job.empresa || "-"}</TableCell>
                    <TableCell>{job.local || "-"}</TableCell>
                    <TableCell>
                      {keywords.length > 0 ? (
                        <div className="flex flex-wrap gap-1 text-sm text-foreground/85">
                          {keywords.map((keyword, keywordIndex) => (
                            <div
                              key={`${jobId}-${keyword}`}
                              className="flex items-center"
                            >
                              <span>{keyword}</span>
                              {keywordIndex < keywords.length - 1 ? (
                                <span aria-hidden="true">,&nbsp;</span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center align-middle">
                      <StatusToggleButton
                        label={`Marcar vaga como spam para ${job.titulo || "vaga"}`}
                        pressed={isSpamMarked}
                        activeClassName="text-[#0c6b35]"
                        onClick={() =>
                          setSpamMarks((current) => ({
                            ...current,
                            [jobId]: !current[jobId],
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell className="text-center align-middle">
                      <StatusToggleButton
                        label={`Marcar vaga como lida para ${job.titulo || "vaga"}`}
                        pressed={isReadMarked}
                        activeClassName="text-[#0c6b35]"
                        onClick={() =>
                          setReadMarks((current) => ({
                            ...current,
                            [jobId]: !current[jobId],
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {job.source ? (
                        <Badge
                          variant="secondary"
                          className="border-border/60 bg-muted text-foreground"
                        >
                          {job.source}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}

              {!loading && filteredJobs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Nenhuma vaga encontrada com os filtros atuais.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 border-t border-border/60 pt-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{resultsLabel}</span>
            <span> (Atualizado em {formatDate(meta.modifiedAt)})</span>
          </p>

          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <label
              htmlFor="page-size"
              className="flex w-fit items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm"
            >
              <span className="text-muted-foreground">Itens por página</span>
              <select
                id="page-size"
                aria-label="Itens por página"
                className="w-20 rounded-md bg-background px-2 py-1 text-center font-semibold text-foreground outline-none transition-colors"
                value={pageSize}
                onChange={(event) =>
                  onPageSizeChange(Number(event.target.value))
                }
              >
                {[5, 10, 25, 50].map((size) => (
                  <option
                    key={size}
                    value={size}
                    className="bg-background text-foreground"
                  >
                    {size}
                  </option>
                ))}
              </select>
            </label>

            <nav
              className="flex items-center gap-1 self-end md:self-auto"
              aria-label="Paginação"
            >
              <button
                type="button"
                aria-label="Pagina anterior"
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="flex h-9 min-w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <FiChevronLeft className="h-4 w-4" />
              </button>

              {paginationItems.map((item, index) => {
                if (typeof item !== "number") {
                  return (
                    <span
                      key={`${item}-${index}`}
                      className="px-2 text-sm text-muted-foreground"
                      aria-hidden="true"
                    >
                      …
                    </span>
                  );
                }

                const isCurrent = item === currentPage;

                return (
                  <button
                    key={item}
                    type="button"
                    aria-current={isCurrent ? "page" : undefined}
                    onClick={() => onPageChange(item)}
                    className={cn(
                      "flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm font-medium transition-colors",
                      isCurrent
                        ? "bg-[#0c6b35] text-white shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {item}
                  </button>
                );
              })}

              <button
                type="button"
                aria-label="Pagina seguinte"
                onClick={() =>
                  onPageChange(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
                className="flex h-9 min-w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <FiChevronRight className="h-4 w-4" />
              </button>
            </nav>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
