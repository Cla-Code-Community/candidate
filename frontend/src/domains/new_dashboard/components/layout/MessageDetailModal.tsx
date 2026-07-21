import { Bot, BriefcaseBusiness, UserRound } from "lucide-react";
import type { Message, MessageOrigin } from "../../types";
import { Modal } from "../shared/Modal";

interface MessageDetailModalProps {
  message: Message;
  onClose: () => void;
}

const originConfig: Record<
  MessageOrigin,
  { label: string; Icon: typeof UserRound; className: string }
> = {
  recruiter: {
    label: "Recrutador",
    Icon: BriefcaseBusiness,
    className:
      "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  mentor: {
    label: "Mentoria",
    Icon: UserRound,
    className:
      "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  system: {
    label: "Sistema",
    Icon: Bot,
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
};

export function MessageDetailModal({
  message,
  onClose,
}: MessageDetailModalProps) {
  const origin = message.origin ?? "system";
  const { Icon, label, className } = originConfig[origin];

  return (
    <Modal
      title={message.sender}
      subtitle={message.date}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="h-10 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Fechar
        </button>
      }
    >
      <div className="space-y-5">
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${className}`}
        >
          <Icon className="h-4 w-4" />
          {label}
        </span>

        <div className="rounded-md border border-border bg-background/60 p-4">
          <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">
            {message.text}
          </p>
        </div>
      </div>
    </Modal>
  );
}
