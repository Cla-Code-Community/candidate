import { Github } from "lucide-react";
import LogoWhite from "@/shared/assets/logo-painel-vagas.svg";
import LogoBlack from "@/shared/assets/black.svg";

export function Footer() {
  return (
    <footer className="bg-neutral-50 dark:bg-transparent text-neutral-900 dark:text-white pt-16 pb-8 border-t border-gray-200 dark:border-white/10">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="md:col-span-2">

            <div className="flex items-center text-[30px] mb-6">
              <span className="text-blue-500 font-light">&lt;</span>
              Cand<span className="text-amber-500">!</span>Date<span className="text-purple-500">!</span>
              <span className="text-blue-500 font-light">&gt;</span>
            </div>

            <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-8 leading-relaxed">
              Automatizando a busca por vagas de TI para desenvolvedores do mundo inteiro. Encontre o emprego ideal sem perder horas pesquisando.
            </p>
            <div className="flex items-center gap-4 text-gray-400 dark:text-gray-500">
              <a href="https://github.com/Cla-Code-Community/candidate" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"><Github size={20} /></a>
            </div>
          </div>

          <div>
            <h4 className="text-gray-900 dark:text-white font-semibold mb-6">Produto</h4>
            <ul className="space-y-4 text-gray-500 dark:text-gray-400">
              <li><a href="#features" className="hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors">Funcionalidades</a></li>
              <li><a href="#time" className="hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors">Time</a></li>
              <li><a href="#how-it-works" className="hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors">Como Funciona</a></li>
              <li><a href="#status" className="hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors">Status</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-gray-900 dark:text-white font-semibold mb-6">Legal</h4>
            <ul className="space-y-4 text-gray-500 dark:text-gray-400">
              <li><a href="#" className="hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors">Termos de Uso</a></li>
              <li><a href="#" className="hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors">Privacidade</a></li>
              <li><a href="#" className="hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors">Contato</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-200 dark:border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400 dark:text-gray-500">
          <p>&copy; {new Date().getFullYear()} Painel de Vagas. Todos os direitos reservados.</p>
          <div className="flex gap-6">

          </div>
        </div>
      </div>
    </footer>
  );
}
