import { CheckCircle2 } from "lucide-react";

interface ToastProps {
  message: string;
}

export function Toast({ message }: ToastProps) {
  if (!message) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-card px-4 py-3 text-sm font-semibold text-card-foreground shadow-xl">
      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
      <span>{message}</span>
    </div>
  );
}
