import { createContext, useContext, useState, type ReactNode } from "react";
import { initialJobs, jobStatuses } from "../constants";
import type { Job, JobStatus, NewJob } from "../types";
import { createJobFromForm } from "../utils/helpers";
import { useToastContext } from "./ToastContext";

interface JobsContextValue {
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  updateJobStatus: (jobId: string, status: JobStatus) => void;
  updateJobNotes: (jobId: string, notes: string) => void;
  addNewJob: (newJob: NewJob) => void;
}

const JobsContext = createContext<JobsContextValue | null>(null);

export function JobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const { triggerToast } = useToastContext();

  const updateJobStatus = (jobId: string, status: JobStatus) => {
    setJobs((currentJobs) =>
      currentJobs.map((job) => (job.id === jobId ? { ...job, status } : job)),
    );
    triggerToast(`Vaga atualizada para: ${jobStatuses[status]}`);
  };

  const updateJobNotes = (jobId: string, notes: string) => {
    setJobs((currentJobs) =>
      currentJobs.map((job) => (job.id === jobId ? { ...job, notes } : job)),
    );
  };

  const addNewJob = (newJob: NewJob) => {
    setJobs((currentJobs) => [createJobFromForm(newJob), ...currentJobs]);
    triggerToast("Vaga adicionada às suas oportunidades.");
  };

  return (
    <JobsContext.Provider
      value={{ jobs, setJobs, updateJobStatus, updateJobNotes, addNewJob }}
    >
      {children}
    </JobsContext.Provider>
  );
}

export function useJobsContext() {
  const context = useContext(JobsContext);
  if (!context) {
    throw new Error("useJobsContext must be used within JobsProvider");
  }
  return context;
}

