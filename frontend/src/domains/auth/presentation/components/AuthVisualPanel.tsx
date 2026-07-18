import { Image } from "@unpic/react";
import { Bell, Instagram, Linkedin, Search, TrendingUp } from "lucide-react";

export default function LeftSide() {
  return (
    <aside className="relative hidden w-full lg:w-1/2 flex-col justify-between p-8 xl:p-12 lg:flex overflow-hidden min-h-screen select-none transition-colors duration-300 font-sans">
      <div className="absolute right-0 top-0 bottom-0 w-[85%] bg-neutral-100 dark:bg-neutral-900 rounded-l-[120px] overflow-hidden -z-10 transition-colors">
        <Image
          src="/leftSide.png"
          alt="Profissionais de tecnologia"
          layout="fullWidth"
          className="h-full w-full object-cover opacity-[0.85] dark:opacity-30 mix-blend-multiply dark:mix-blend-luminosity"
          priority={true}
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 via-purple-500/5 to-transparent pointer-events-none" />
      </div>

      <div className="max-w-xl z-10 space-y-4 mt-6">
        <h1 className="text-4xl xl:text-5xl font-extrabold tracking-normal text-gray-950 dark:text-white leading-tight">
          Conectando talentos <br />
          às melhores oportunidades
        </h1>
        <p className="text-sm xl:text-base font-medium text-[#004726] dark:text-neutral-400 max-w-lg">
          Centralizamos oportunidades para ajudar profissionais de tecnologia a
          encontrarem sua próxima vaga global.
        </p>
      </div>

      <div className="absolute left-8 xl:left-12 top-[35%] space-y-4 z-10 w-[170px]">
        {" "}
        <div className=" w-[170px] h-[113px] -translate-x-4 flex flex-col gap-3 bg-white/40 dark:bg-neutral-900/40 backdrop-blur-md p-4 rounded-2xl border border-[#C0C9BF] dark:border-neutral-800/50 hover:border-teal-500/50 dark:hover:border-teal-400/50 hover:shadow-lg hover:shadow-teal-500/5 transition-all duration-300 group">
          <div className="bg-gradient-to-br from-[#004726] to-[#00663A] dark:from-[#004726] dark:to-[#00663A] p-2.5 rounded-xl text-white w-fit shadow-sm shadow-green-900/20">
            <Search className="h-4 w-4" />
          </div>
          <p className="text-xs font-bold text-gray-900 dark:text-neutral-200 leading-tight">
            Encontre vagas e mentorias
          </p>
        </div>
        <div className=" w-[170px] h-[113px] translate-x-40 flex flex-col gap-3 bg-white/40 dark:bg-neutral-900/40 backdrop-blur-md p-4 rounded-2xl border border-[#004726]/50 dark:border-[#004726]/50 hover:border-teal-500/50 dark:hover:border-[#004726] hover:shadow-lg hover:shadow-[#004726]/10 transition-all duration-300 group">
          <div className="bg-gradient-to-br from-[#004726] to-[#00663A] dark:from-[#004726] dark:to-[#00663A] p-2.5 rounded-xl text-white w-fit shadow-sm shadow-green-900/20">
            <Bell className="h-4 w-4" />
          </div>
          <p className="text-xs font-bold text-gray-900 dark:text-neutral-200 leading-tight">
            Novas oportunidades
          </p>
        </div>
        <div className=" w-[170px] h-[113px] -translate-x-4 flex flex-col gap-3 bg-white/40 dark:bg-neutral-900/40 backdrop-blur-md p-4 rounded-2xl border border-[#C0C9BF] dark:border-neutral-800/50 hover:border-teal-500/50 dark:hover:border-teal-400/50 hover:shadow-lg hover:shadow-teal-500/5 transition-all duration-300 group">
          <div className="bg-gradient-to-br from-[#004726] to-[#00663A] dark:from-[#004726] dark:to-[#00663A] p-2.5 rounded-xl text-white w-fit shadow-sm shadow-green-900/20">
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
          className="bg-[#004726] hover:bg-[#00663A] dark:bg-[#004726] dark:hover:bg-[#00804A] border border-[#004726] p-2.5 rounded-xl text-white hover:border-[#00663A] transition-all shadow-sm"
        >
          <Instagram className="h-4 w-4" />
        </a>
        <a
          href="#"
          className="bg-[#004726] hover:bg-[#00663A] dark:bg-[#004726] dark:hover:bg-[#00804A] border border-[#004726] p-2.5 rounded-xl text-white hover:border-[#00663A] transition-all shadow-sm"
        >
          <Linkedin className="h-4 w-4" />
        </a>
      </div>
    </aside>
  );
}
