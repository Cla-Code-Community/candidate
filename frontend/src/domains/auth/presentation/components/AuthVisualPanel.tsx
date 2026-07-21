import { Image } from "@unpic/react"
import { Bell, Instagram, Linkedin, Search, TrendingUp } from "lucide-react"

export default function LeftSide() {
  return (
    <aside className="relative hidden w-full lg:w-1/2 flex-col justify-between p-8 xl:p-12 lg:flex overflow-hidden min-h-screen select-none transition-colors duration-300 font-sans">

      <div className="absolute right-0 top-0 bottom-0 w-[85%] bg-neutral-100 dark:bg-neutral-900 rounded-l-[120px] overflow-hidden -z-10 transition-colors">
        <Image
          src="/leftSide.png"
          alt="Profissionais de tecnologia"
          layout="fullWidth"
          className="h-full w-full object-cover opacity-[0.85] dark:opacity-30 mix-blend-multiply dark:mix-blend-luminosity"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 via-purple-500/5 to-transparent pointer-events-none" />
      </div>

      <div className="max-w-xl z-10 space-y-4 mt-6">
        <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-gray-950 dark:text-white leading-tight">
          Conectando talentos <br />
          <span className="bg-gradient-to-r from-blue-600 via-purple-500 to-amber-500 bg-clip-text text-transparent dark:from-blue-400 dark:via-purple-400 dark:to-amber-400">
            às melhores oportunidades
          </span>
        </h1>
        <p className="text-sm xl:text-base font-semibold text-gray-600 dark:text-neutral-400 max-w-lg">
          Centralizamos oportunidades para ajudar profissionais de tecnologia a encontrarem sua próxima vaga global.
        </p>
      </div>

      <div className="absolute left-8 xl:left-12 top-[35%] space-y-4 z-10 w-full max-w-[220px] xl:max-w-[240px]">

        <div className="flex flex-col gap-3 bg-white/40 dark:bg-neutral-900/40 backdrop-blur-md p-4 rounded-2xl border border-white/60 dark:border-neutral-800/50 hover:border-blue-500/50 dark:hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300 group">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600 p-2.5 rounded-xl text-white w-fit shadow-sm shadow-blue-500/20">
            <Search className="h-4 w-4" />
          </div>
          <p className="text-xs font-bold text-gray-900 dark:text-neutral-200 leading-tight">
            Encontre vagas e mentorias
          </p>
        </div>

        <div className="flex flex-col gap-3 bg-white/40 dark:bg-neutral-900/40 backdrop-blur-md p-4 rounded-2xl border border-white/60 dark:border-neutral-800/50 hover:border-purple-500/50 dark:hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/5 translate-x-6 xl:translate-x-10 transition-all duration-300 group">
          <div className="bg-gradient-to-br from-purple-600 to-purple-700 dark:from-purple-500 dark:to-purple-600 p-2.5 rounded-xl text-white w-fit shadow-sm shadow-purple-500/20">
            <Bell className="h-4 w-4" />
          </div>
          <p className="text-xs font-bold text-gray-900 dark:text-neutral-200 leading-tight">
            Novas oportunidades
          </p>
        </div>

        <div className="flex flex-col gap-3 bg-white/40 dark:bg-neutral-900/40 backdrop-blur-md p-4 rounded-2xl border border-white/60 dark:border-neutral-800/50 hover:border-teal-500/50 dark:hover:border-teal-400/50 hover:shadow-lg hover:shadow-teal-500/5 transition-all duration-300 group">
          <div className="bg-gradient-to-br from-teal-600 to-teal-700 dark:from-teal-500 dark:to-teal-600 p-2.5 rounded-xl text-white w-fit shadow-sm shadow-teal-500/20">
            <TrendingUp className="h-4 w-4" />
          </div>
          <p className="text-xs font-bold text-gray-900 dark:text-neutral-200 leading-tight">
            Desenvolvimento profissional
          </p>
        </div>

      </div>

      <div className="flex gap-3 z-10 mt-auto pl-2">
        <a
          href="https://instagram.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 p-2.5 rounded-xl text-gray-700 dark:text-neutral-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500/30 dark:hover:border-blue-400/30 transition-all shadow-sm"
        >
          <Instagram className="h-4 w-4" />
        </a>
        <a
          href="#"
          className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 p-2.5 rounded-xl text-gray-700 dark:text-neutral-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500/30 dark:hover:border-blue-400/30 transition-all shadow-sm"
        >
          <Linkedin className="h-4 w-4" />
        </a>
      </div>
    </aside>
  )
}
