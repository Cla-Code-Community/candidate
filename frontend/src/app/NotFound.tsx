import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

import lottieAnimation from "@/shared/assets/lottie.json";

export default function NotFound() {
  return (
    <section className="min-h-screen flex flex-col items-center justify-center relative bg-white dark:bg-[#0d1a14] font-sans px-6">

      <div className="absolute w-[500px] h-[500px] bg-emerald-100/20 dark:bg-emerald-950/10 blur-[100px] rounded-full pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

      <div className="relative z-10 text-center max-w-md mx-auto flex flex-col items-center">

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-80 h-80 md:w-96 md:h-96 flex items-center justify-center select-none pointer-events-none -mb-2"
        >
          <DotLottieReact
            data={lottieAnimation}
            loop
            autoplay
          />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2"
        >
          Ops! Página não encontrada
        </motion.h2>


        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="text-gray-400 dark:text-neutral-400 text-sm md:text-base mb-6 font-normal"
        >
          Parece que o panda se perdeu no caminho.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <Link
            to="/"
            className="inline-flex items-center justify-center bg-white dark:bg-white text-black dark:text-black font-semibold text-sm px-6 py-2.5 rounded-xl transition-all shadow-sm hover:bg-gray-100"
          >
            Voltar para o Início
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
