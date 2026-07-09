import { Terminal } from "lucide-react";
import type { LogEntry } from "../../schemas/scraper.schema";

interface EventConsoleProps {
  logs: LogEntry[];
  onClear: () => void;
}

/**
 * Console de eventos em tempo real (ações de start/pause dos scrapers).
 * Substitui o antigo `HeartBeat` (ícone inexistente no lucide-react) por Terminal.
 */
export function EventConsole({ logs, onClear }: EventConsoleProps) {
  return (
    <div className="bg-slate-950 text-slate-100 p-6 rounded-xl border border-slate-800 font-mono text-xs shadow-md space-y-4">
      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Terminal size={16} className="text-emerald-400" />
          <span className="font-bold text-slate-300">
            Terminal de Eventos do Sistema
          </span>
        </div>
        <button
          onClick={onClear}
          className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded"
        >
          Limpar Logs
        </button>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="text-slate-500 py-4 text-center italic">
            Nenhum evento registrado ainda. Execute alguma alteração nos
            scrapers para ver.
          </div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="flex gap-4">
              <span className="text-emerald-500 font-semibold">
                [{log.time}]
              </span>
              <span className="text-slate-300">{log.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
