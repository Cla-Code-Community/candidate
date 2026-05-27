import { Github, Twitter, Linkedin } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-neutral-50 dark:bg-transparent text-neutral-900 dark:text-white pt-16 pb-8 border-t border-gray-200 dark:border-white/10">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          {/* Brand Column */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-[#0c6b35] flex items-center justify-center">
                <span className="text-white font-bold text-lg leading-none mt-0.5">J</span>
              </div>
              <span className="text-gray-900 dark:text-white font-bold text-xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Jobs Scraper
              </span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-8 leading-relaxed">
              Automatizando a busca por vagas de TI para desenvolvedores do mundo inteiro. Encontre o emprego ideal sem perder horas pesquisando.
            </p>
            <div className="flex items-center gap-4 text-gray-400 dark:text-gray-500">
              <a href="#" className="hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"><Twitter size={20} /></a>
              <a href="#" className="hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"><Github size={20} /></a>
              <a href="#" className="hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"><Linkedin size={20} /></a>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="text-gray-900 dark:text-white font-semibold mb-6">Produto</h4>
            <ul className="space-y-4 text-gray-500 dark:text-gray-400">
              <li><a href="#features" className="hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors">Funcionalidades</a></li>
              <li><a href="#how-it-works" className="hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors">Como Funciona</a></li>
              <li><a href="#pricing" className="hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors">Preços</a></li>
              <li><a href="#status" className="hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors">Status</a></li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="text-gray-900 dark:text-white font-semibold mb-6">Legal</h4>
            <ul className="space-y-4 text-gray-500 dark:text-gray-400">
              <li><a href="#" className="hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors">Termos de Uso</a></li>
              <li><a href="#" className="hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors">Privacidade</a></li>
              <li><a href="#" className="hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors">Contato</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-gray-200 dark:border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400 dark:text-gray-500">
          <p>&copy; {new Date().getFullYear()} Jobs Scraper. Todos os direitos reservados.</p>
          <div className="flex gap-6">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Sistemas Operacionais
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
