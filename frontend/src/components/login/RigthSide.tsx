import { Eye } from "lucide-react"
import { Image } from "@unpic/react"

export default function RightSide() {
  return (
    <main className="flex w-full lg:w-1/2 flex-col justify-center px-6 py-12 sm:px-16 lg:px-20 xl:px-24 bg-white dark:bg-slate-900 min-h-screen transition-colors duration-300">
      <div className="mx-auto w-full max-w-md">

        <div className="text-center mb-8">
          <h2 className="text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white flex items-center justify-center gap-1 select-none">
            <span className="text-blue-500 font-light">&lt;</span>
            Cand<span className="text-amber-500">!</span>Date<span className="text-purple-500">!</span>
            <span className="text-blue-500 font-light">&gt;</span>
          </h2>
          <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
            Novo por aqui?{" "}
            <a href="#" className="font-semibold text-emerald-500 dark:text-emerald-400 underline underline-offset-2 hover:text-emerald-600 transition-colors">
              Cadastre-se
            </a>
          </p>
        </div>

        <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              defaultValue=""
              placeholder="Ex: bene17@gmail.com"
              className="w-full px-4 py-3 rounded-xl border border-neutral-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow shadow-sm"
            />
          </div>

          <div>
            <label htmlFor="senha" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              Senha
            </label>
            <div className="relative">
              <input
                id="senha"
                type="password"
                defaultValue=""
                placeholder="Ex: ••••••••••••"
                className="w-full px-4 py-3 rounded-xl border border-neutral-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow shadow-sm"
              />
              <button
                type="button"
                onClick={revelPassword}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
              >
                <Eye className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-neutral-700 dark:text-neutral-300 font-medium select-none">
              <input
                type="checkbox"
                defaultChecked
                className="h-4 w-4 rounded border-neutral-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-emerald-600 focus:ring-emerald-500 accent-[#004726]"
              />
              Lembre de mim
            </label>
            <a href="#" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
              Esqueceu a senha?
            </a>
          </div>

          <button
            type="submit"
            className="w-full bg-[#004726] dark:bg-emerald-600 text-white py-3 px-4 rounded-xl font-bold text-base hover:bg-[#00331a] dark:hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors shadow-sm mt-2"
          >
            Entrar
          </button>
        </form>

        <div className="mt-8">
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-200 dark:border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-xs text-neutral-400 dark:text-neutral-500 uppercase select-none">
              <span className="bg-white dark:bg-slate-900 px-4 font-medium">Ou faça login com</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">

            <button className="flex justify-center items-center py-2.5 px-4 border border-neutral-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 hover:bg-neutral-50 dark:hover:bg-slate-700 transition-all shadow-sm group">
              <Image
                src="/google.png"
                alt="Google"
                width={20}
                height={20}
                className="object-contain"
              />
            </button>

            <button className="flex justify-center items-center py-2.5 px-4 border border-neutral-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 hover:bg-neutral-50 dark:hover:bg-slate-700 transition-all shadow-sm group">
              <Image
                src="/facebook.png"
                alt="Facebook"
                width={20}
                height={20}
                className="object-contain"
              />
            </button>

            <button className="flex justify-center items-center py-2.5 px-4 border border-neutral-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 hover:bg-neutral-50 dark:hover:bg-slate-700 transition-all shadow-sm group">
              <svg className="h-5 w-5 fill-black dark:fill-white transition-colors" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.21.67-2.93 1.49-.62.69-1.16 1.84-1.01 2.96 1.12.09 2.27-.58 2.95-1.39z"/>
              </svg>
            </button>

          </div>
        </div>

      </div>
    </main>
  )
}
