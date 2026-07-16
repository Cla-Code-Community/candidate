import { CheckCircle2, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { Mentor } from "../../types";
import { Modal } from "../shared/Modal";

interface MentorDetailModalProps {
  mentor: Mentor;
  onClose: () => void;
}

export function MentorDetailModal({ mentor, onClose }: MentorDetailModalProps) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <Modal
      title={mentor.name}
      subtitle={`${mentor.completed} mentorias concluídas`}
      onClose={onClose}
      footer={
        <>
          <a
            href={mentor.platformUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Abrir {mentor.platform}
            <ExternalLink className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={() => setConfirmed(true)}
            className="h-10 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground"
          >
            Confirmar participação
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-muted-foreground">{mentor.specialty}</p>
        <div className="rounded-md border border-border bg-background p-3">
          <span className="text-xs font-bold uppercase text-muted-foreground">Disponibilidade</span>
          <p className="mt-1 font-semibold">
            {mentor.days}, {mentor.hours}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{mentor.nextSessionDate}</p>
        </div>
        <div className="rounded-md border border-border bg-background p-3">
          <span className="text-xs font-bold uppercase text-muted-foreground">Plataforma</span>
          <p className="mt-1 font-semibold">{mentor.platform}</p>
          <a
            href={mentor.platformUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex text-xs font-bold text-primary hover:underline"
          >
            {mentor.platformUrl}
          </a>
        </div>
        <div className="rounded-md border border-border bg-background p-3">
          <span className="text-xs font-bold uppercase text-muted-foreground">
            O que será ministrado
          </span>
          <p className="mt-1 leading-6 text-slate-600 dark:text-slate-300">
            {mentor.agenda}
          </p>
        </div>
        {confirmed ? (
          <div className="flex items-start gap-3 rounded-md border border-emerald-500/25 bg-emerald-500/10 p-3 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm font-semibold">
              Participação confirmada. O encontro será realizado via {mentor.platform}.
            </p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
