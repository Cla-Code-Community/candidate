import { useState } from "react";
import type { Job, JobStatus } from "../../types";
import { KanbanColumn } from "./KanbanColumn";

interface KanbanBoardProps {
  jobs: Job[];
  onOpenJob: (job: Job) => void;
  onStatusChange: (jobId: string, status: JobStatus) => void;
}

const columns = ["saved", "applied", "interviewing", "rejected", "accepted"] as const;

export function KanbanBoard({
  jobs,
  onOpenJob,
  onStatusChange,
}: KanbanBoardProps) {
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);

  const draggedJob = draggedJobId
    ? jobs.find((job) => job.id === draggedJobId)
    : null;

  function handleDrop(status: JobStatus) {
    if (!draggedJob || draggedJob.status === status) return;
    onStatusChange(draggedJob.id, status);
  }

  return (
    <div className="grid gap-4 overflow-x-auto pb-2 md:grid-cols-2 xl:grid-cols-5">
      {columns.map((status) => (
        <KanbanColumn
          key={status}
          status={status}
          jobs={jobs.filter((job) => job.status === status)}
          onOpenJob={onOpenJob}
          draggedJobId={draggedJobId}
          onDragStart={setDraggedJobId}
          onDragEnd={() => setDraggedJobId(null)}
          onDropJob={handleDrop}
        />
      ))}
    </div>
  );
}
