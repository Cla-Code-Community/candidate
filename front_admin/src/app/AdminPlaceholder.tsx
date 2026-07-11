import { Settings } from "lucide-react";

interface AdminPlaceholderProps {
  section: string;
}

export function AdminPlaceholder({ section }: AdminPlaceholderProps) {
  return (
    <section className="min-h-90 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f131a] flex flex-col items-center justify-center text-center p-8 theme-transition">
      <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 flex items-center justify-center mb-4">
        <Settings size={22} />
      </div>
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
        {section}
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md">
        Esta seção já está integrada ao menu e ao layout administrativo. A tela
        funcional pode ser conectada aqui quando o módulo estiver disponível.
      </p>
    </section>
  );
}
