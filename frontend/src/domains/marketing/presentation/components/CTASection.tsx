import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export function CTASection() {
  return (
    <section id="status" className="relative py-24 md:py-32 overflow-hidden bg-transparent">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-purple-500/10 blur-[150px] rounded-full" />
        <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-blue-500/10 dark:bg-blue-950/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-amber-500/5 dark:bg-amber-950/10 blur-[120px] rounded-full" />
      </div>

      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-4xl md:text-6xl font-extrabold text-gray-900 dark:text-white mb-6 leading-tight tracking-tight"
        >
          Pronto para transformar sua{" "}
          <span className="bg-gradient-to-r from-blue-600 to-purple-500 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
            busca por vagas
          </span>
          ?
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-lg md:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed font-medium"
        >
          Junte-se a centenas de desenvolvedores que já estão usando o{" "}
          <span className="text-gray-900 dark:text-white font-bold">
            <span className="text-blue-500 font-light">&lt;</span>
            Cand<span className="text-amber-500">!</span>Date<span className="text-purple-500">!</span>
            <span className="text-blue-500 font-light">&gt;</span>
          </span>{" "}
          para encontrar as melhores oportunidades de forma automatizada.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            to="/login"
            className="group inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-95 text-white font-semibold text-base py-4 px-10 rounded-full transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-blue-500/10"
          >
            Acessar vagas
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>

          <a
            href="#features"
            className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white font-semibold text-base py-4 px-8 rounded-full border border-gray-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-all duration-300"
          >
            Explorar funcionalidades
          </a>
        </motion.div>
      </div>
    </section>
  );
}
