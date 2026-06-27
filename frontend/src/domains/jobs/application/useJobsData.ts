import { fetchJobFiles, fetchJobsByFile, runScraperRequest } from "@/domains/jobs/infrastructure/jobsApi";
import type { Job, JobFile, JobsMeta } from "@/domains/jobs/domain/job.types";
import { useCallback, useEffect, useState } from "react";

const EMPTY_META: JobsMeta = { file: "", modifiedAt: null, total: 0 };

export function useJobsData() {
  const [files, setFiles] = useState<JobFile[]>([]);
  const [selectedFile, setSelectedFile] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [meta, setMeta] = useState<JobsMeta>(EMPTY_META);
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState("");

  const loadFiles = useCallback(async () => {
    const foundFiles = await fetchJobFiles();
    setFiles(foundFiles);
    return foundFiles;
  }, []);

  const loadJobs = useCallback(async (fileName: string) => {
    setLoading(true);
    setError("");

    try {
      const data = await fetchJobsByFile(fileName);
      setJobs(data.jobs);
      setMeta({
        file: data.file,
        modifiedAt: data.modifiedAt,
        total: data.total,
      });

      if (data.file && data.file !== fileName) {
        setSelectedFile(data.file);
      }
    } catch (err: unknown) {
      setJobs([]);
      setMeta(EMPTY_META);
      setError(err instanceof Error ? err.message : "Erro inesperado ao carregar vagas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function initializeFiles() {
      const foundFiles = await loadFiles();
      if (foundFiles[0]?.file) {
        setSelectedFile(foundFiles[0].file);
      }
    }

    initializeFiles().catch(() => {
      setError("Nao foi possivel listar arquivos .xlsx da pasta output.");
    });
  }, [loadFiles]);

  useEffect(() => {
    const syncState = setTimeout(() => {
      if (!selectedFile) {
        setJobs([]);
        setMeta(EMPTY_META);
        return;
      }

      loadJobs(selectedFile);
    }, 0);

    return () => clearTimeout(syncState);
  }, [selectedFile, loadJobs]);

  const triggerScraper = useCallback(async () => {
    setScraping(true);
    setError("");

    try {
      await runScraperRequest();
      const foundFiles = await loadFiles();
      const nextFile = foundFiles[0]?.file ?? "";

      if (!nextFile) {
        setSelectedFile("");
        setJobs([]);
        setMeta(EMPTY_META);
        return;
      }

      if (nextFile !== selectedFile) {
        setSelectedFile(nextFile);
        return;
      }

      await loadJobs(nextFile);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao executar o scraper.");
    } finally {
      setScraping(false);
    }
  }, [loadFiles, loadJobs, selectedFile]);

  return {
    files,
    selectedFile,
    setSelectedFile,
    jobs,
    meta,
    loading,
    scraping,
    error,
    loadJobs,
    triggerScraper,
  };
}
