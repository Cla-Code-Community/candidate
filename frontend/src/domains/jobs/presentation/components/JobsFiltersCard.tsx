import { Badge } from "@/shared/ui/badge";
import { Card, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import type { JobFile, JobsMeta } from "@/domains/jobs/domain/job.types";
import {
  useMemo,
  useState,
  type FormEvent,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  FiBriefcase,
  FiCheck,
  FiFileText,
  FiFilter,
  FiPlus,
  FiSearch,
  FiSlash,
  FiTag,
} from "react-icons/fi";
import { KeywordsModal } from "./KeywordsModal";
import { Button } from "@/shared/ui/button";
interface JobsFiltersCardProps {
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  keywordFilter: string[];
  setKeywordFilter: Dispatch<SetStateAction<string[]>>;
  onRemoveFilter: (filterToRemove: string) => void;
  onClearFilters: () => void;
  keywords: string[];
  selectedFile: string;
  setSelectedFile: Dispatch<SetStateAction<string>>;
  files: JobFile[];
  meta: JobsMeta;
  actions?: ReactNode;
}

function getSelectedFilters(search: string, keywordFilter: string[]) {
  const searchTerms = search
    .split(/[,;/]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return Array.from(
    new Set([...keywordFilter.filter(Boolean), ...searchTerms]),
  );
}

export function JobsFiltersCard({
  search,
  setSearch,
  keywordFilter,
  setKeywordFilter,
  onRemoveFilter,
  onClearFilters,
  keywords,
  selectedFile,
  setSelectedFile,
  files,
  meta,
  actions,
}: JobsFiltersCardProps) {
  const [seeKeywordsModal, setSeeKeywordsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const selectedFilters = useMemo(
    () => getSelectedFilters(search, keywordFilter),
    [search, keywordFilter],
  );

  const handleManageFilters = () => {
    setSeeKeywordsModal(true);
  };

  const handleKeywordSelect = (value: string) => {
    if (!value) {
      return;
    }

    if (value === "all") {
      setKeywordFilter([]);
      return;
    }

    setKeywordFilter((current) =>
      current.includes(value) ? current : [...current, value],
    );
  };

  const handleAddSearchTerm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextTerm = searchTerm.trim();

    if (!nextTerm) {
      return;
    }

    setSearch((current) => {
      const currentTerms = getSelectedFilters(current, []);

      if (currentTerms.includes(nextTerm)) {
        return current;
      }

      return [...currentTerms, nextTerm].join(", ");
    });
    setSearchTerm("");
  };

  return (
    <>
      <Card className="rounded-[24px] border border-slate-200 bg-white/95 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur dark:border-[#2b3f58] dark:bg-[#131d31]/95 dark:shadow-[0_18px_45px_rgba(3,8,20,0.25)]">
        <CardContent className="flex flex-col gap-4 p-5 md:p-6">
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <form className="relative flex-1" onSubmit={handleAddSearchTerm}>
              <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-14 w-full rounded-2xl border border-slate-300 bg-white pl-11 pr-14 text-base text-slate-900 placeholder:text-slate-500 focus-visible:ring-[#14AE5C]/40 dark:border-[#35506f] dark:bg-[#091224] dark:text-slate-100 dark:placeholder:text-slate-400"
                placeholder="Buscar por título, empresa, local ou link"
              />
              <button
                type="submit"
                aria-label="Adicionar filtro de busca"
                className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-[#0c6b35] text-white transition-colors hover:bg-[#0a5b2d] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!searchTerm.trim()}
              >
                <FiPlus className="h-4 w-4" />
              </button>
            </form>
            <div className="flex items-center gap-2">{actions}</div>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
              <select
                aria-label="Filtrar por palavra-chave"
                className="h-12 min-w-[220px] rounded-2xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#14AE5C]/40 dark:border-[#35506f] dark:bg-[#0b1527] dark:text-slate-100"
                value={keywordFilter[keywordFilter.length - 1] ?? "all"}
                onChange={(event) => handleKeywordSelect(event.target.value)}
              >
                <option value="all">Todas as palavras chaves</option>
                {keywords.map((keyword) => (
                  <option key={keyword} value={keyword}>
                    {keyword}
                  </option>
                ))}
              </select>

              <select
                aria-label="Selecionar arquivo"
                className="h-12 min-w-[180px] rounded-2xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#14AE5C]/40 dark:border-[#35506f] dark:bg-[#0b1527] dark:text-slate-100"
                value={selectedFile}
                onChange={(event) => setSelectedFile(event.target.value)}
              >
                {files.map((file) => (
                  <option key={file.file} value={file.file}>
                    {file.file}
                  </option>
                ))}
              </select>

              <div>
                <Badge
                  variant="secondary"
                  className="gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs text-slate-700 dark:border-[#35506f] dark:bg-[#24324c] dark:text-slate-100"
                >
                  <FiFileText className="h-3.5 w-3.5" />
                  {meta.file || "Sem arquivo"}
                </Badge>

                <Badge className="gap-1.5 rounded-full bg-[#0c6b35] px-3 py-1 text-xs text-white">
                  <FiBriefcase className="h-3.5 w-3.5" />
                  {meta.total} vagas
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start xl:self-auto">
              <Button
                type="button"
                className="h-10 rounded-xl bg-[#0c6b35] px-4 text-white hover:bg-[#0a5b2d]"
                onClick={handleManageFilters}
              >
                <FiFilter className="h-4 w-4" />
                Filtrar
              </Button>
              <Button
                type="button"
                variant="outline"
                aria-label="Limpar filtros"
                className="h-10 w-10 rounded-md border-[#0c6b35] bg-[#0c6b35] p-0 text-white shadow-sm hover:bg-[#0a5b2d]"
                onClick={onClearFilters}
              >
                <FiSlash className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-[#2b3f58] dark:bg-[#12203a]/45">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Filtros selecionados
              </span>
              {selectedFilters.length > 0 ? (
                selectedFilters.map((filter) => (
                  <Badge
                    key={filter}
                    className="gap-1.5 rounded-full border border-[#14AE5C]/30 bg-[#14AE5C]/12 px-2 py-1 text-xs font-semibold text-[#0c6b35] dark:text-[#8df0af]"
                  >
                    <FiCheck className="h-3 w-3" />
                    <FiTag className="h-3 w-3" />
                    <span>{filter}</span>
                    <button
                      type="button"
                      aria-label={`Remover filtro ${filter}`}
                      className="ml-1 rounded-full p-0.5 text-[#0c6b35] hover:bg-[#14AE5C]/20 dark:text-[#8df0af]"
                      onClick={() => onRemoveFilter(filter)}
                    >
                      <FiSlash className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Use o botão Filtrar para adicionar ou remover palavras-chave.
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      {seeKeywordsModal && (
        <KeywordsModal onClose={() => setSeeKeywordsModal(false)} />
      )}
    </>
  );
}
