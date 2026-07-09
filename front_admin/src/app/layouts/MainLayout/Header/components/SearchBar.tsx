import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <>
      <div className="relative max-w-xs w-full hidden md:block">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search size={16} className="text-slate-400" />
        </span>
        <input
          type="text"
          placeholder="Buscar vagas, scrapers, logs..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm rounded-lg pl-9 pr-4 py-2 text-slate-700 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1e4620] focus:border-transparent transition-all"
        />
      </div>
      <button className="p-2 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg md:hidden">
        <Search size={20} />
      </button>
    </>
  );
}
