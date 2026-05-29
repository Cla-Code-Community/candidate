import { Settings, Bot, Rocket } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  {
    number: "PASSO 01",
    title: "Configure seus filtros",
    description: "Defina suas tecnologias preferidas, nível de senioridade, modelo de trabalho e localização desejada.",
    icon: Settings,
  },
  {
    number: "PASSO 02",
    title: "O robô busca por você",
    description: "Nosso scraper varre dezenas de plataformas automaticamente e coleta as vagas que combinam com seu perfil.",
    icon: Bot,
  },
  {
    number: "PASSO 03",
    title: "Receba e candidate-se",
    description: "Visualize as vagas filtradas no dashboard, exporte relatórios e candidate-se com confiança.",
    icon: Rocket,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 relative overflow-hidden bg-transparent font-sans">
      <div className="max-w-6xl mx-auto px-6">

        <div className="text-center mb-24">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5 }}
            className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight"
          >
            Como funciona ?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-gray-500 dark:text-gray-400 text-lg max-w-2xl mx-auto"
          >
            Em apenas 3 passos, você está pronto para receber as melhores vagas automaticamente.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-4 relative">

          <div className="hidden md:block absolute top-[112px] left-[10%] right-[10%] h-[2px] bg-emerald-200 dark:bg-emerald-800/40" />

          {steps.map((step, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: idx * 0.15, ease: "easeOut" }}
              className="flex flex-col items-center text-center relative group"
            >

              <div className="w-16 h-16 bg-white dark:bg-neutral-800 rounded-2xl flex items-center justify-center mb-8 shadow-md border border-gray-100 dark:border-neutral-700 relative z-10 transition-transform duration-300 group-hover:-translate-y-1">
                <step.icon className="text-[#0c6b35] dark:text-emerald-400 w-6 h-6" />
              </div>

              <div className="hidden md:block w-3 h-3 bg-white dark:bg-neutral-900 border-2 border-emerald-500 rounded-full mb-6 relative z-10" />

              <span className="text-xs font-bold tracking-widest text-emerald-600 dark:text-emerald-400 uppercase mb-3">
                {step.number}
              </span>

              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                {step.title}
              </h3>

              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed max-w-xs px-2">
                {step.description}
              </p>

            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
