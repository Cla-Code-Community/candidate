import { Image } from "@unpic/react"
import { Instagram, Linkedin, Search, Bell, TrendingUp } from "lucide-react"

export default function LeftSide() {
  return (
    <aside className="relative hidden w-full lg:w-1/2 flex-col justify-between p-8 xl:p-12 lg:flex overflow-hidden min-h-screen select-none transition-colors duration-300">

      <div className="absolute right-0 top-0 bottom-0 w-[85%] bg-slate-100 dark:bg-slate-900 rounded-l-[120px] overflow-hidden -z-10 transition-colors">
        <Image
          src="/leftSide.png"
          alt="Profissionais de tecnologia"
          layout="fullWidth"
          className="h-full w-full object-cover opacity-90 dark:opacity-40 mix-blend-multiply dark:mix-blend-luminosity"
          priority
        />
      </div>

      <div className="max-w-xl z-10 space-y-4 mt-6">
        <h1 className="text-3xl xl:text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 leading-tight">
          Conectando talentos <br />
          <span className="text-neutral-900 dark:text-neutral-300">às melhores oportunidades</span>
        </h1>
        <p className="text-sm xl:text-base font-semibold text-[#004726] dark:text-emerald-400 max-w-lg">
          Centralizamos oportunidades para ajudar profissionais de tecnologia a encontrarem sua próxima vaga.
        </p>
      </div>

      <div className="absolute left-8 xl:left-12 top-[35%] space-y-4 z-10 w-full max-w-[220px] xl:max-w-[240px]">

        <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-md border border-neutral-100 dark:border-slate-700 transition-transform hover:scale-105">
          <div className="bg-[#004726] dark:bg-emerald-600 p-2.5 rounded-xl text-white flex-shrink-0">
            <Search className="h-5 w-5" />
          </div>
          <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200 leading-tight">
            Encontre vagas e mentorias
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-md border-2 border-emerald-500/30 dark:border-emerald-500/50 translate-x-6 xl:translate-x-10 transition-transform hover:scale-105">
          <div className="bg-[#004726] dark:bg-emerald-600 p-2.5 rounded-xl text-white flex-shrink-0">
            <Bell className="h-5 w-5" />
          </div>
          <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200 leading-tight">
            Novas oportunidades
          </p>
        </div>
å
        <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-md border border-neutral-100 dark:border-slate-700 transition-transform hover:scale-105">
          <div className="bg-[#004726] dark:bg-emerald-600 p-2.5 rounded-xl text-white flex-shrink-0">
            <TrendingUp className="h-5 w-5" />
          </div>
          <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200 leading-tight">
            Desenvolvimento profissional
          </p>
        </div>
      </div>

      <div className="flex gap-2.5 z-10 mt-auto pl-2">
        <a
          href="https://instragram.com/"
          className="bg-[#004726] dark:bg-emerald-600 p-2 rounded-xl text-white hover:bg-[#00331a] dark:hover:bg-emerald-700 transition-all shadow-sm"
        >
          <Instagram className="h-5 w-5" />
        </a>
        <a
          href="#"
          className="bg-[#004726] dark:bg-emerald-600 p-2 rounded-xl text-white hover:bg-[#00331a] dark:hover:bg-emerald-700 transition-all shadow-sm"
        >
          <Linkedin className="h-5 w-5" />
        </a>
      </div>
    </aside>
  )
}
