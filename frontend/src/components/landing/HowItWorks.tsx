import { Settings, Bot, Rocket } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  {
    number: "01",
    title: "Configure seus filtros",
    description: "Defina suas tecnologias preferidas, nível de senioridade, modelo de trabalho e localização desejada.",
    icon: Settings,
  },
  {
    number: "02",
    title: "O robô busca por você",
    description: "Nosso scraper varre dezenas de plataformas automaticamente e coleta as vagas que combinam com seu perfil.",
    icon: Bot,
  },
  {
    number: "03",
    title: "Receba e candidate-se",
    description: "Visualize as vagas filtradas no dashboard, exporte relatórios e candidate-se com confiança.",
    icon: Rocket,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 relative overflow-hidden bg-transparent">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-20">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5 }}
            className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4"
          >
            Como funciona
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-gray-500 dark:text-gray-400 text-lg max-w-2xl mx-auto"
          >
            Em apenas 3 passos, você está pronto para receber as melhores vagas
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-0 relative">

          <div className="hidden md:block absolute top-[72px] left-[calc(16.66%+40px)] right-[calc(16.66%+40px)] h-px border-t-2 border-dashed border-emerald-200 dark:border-emerald-900/40" />

          {steps.map((step, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: idx * 0.15, ease: "easeOut" }}
              className="flex flex-col items-center text-center relative"
            >

              <span className="text-5xl font-bold dark:text-white text-black mb-4 select-none">
                {step.number}
              </span>

              <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/50 rounded-2xl flex items-center justify-center mb-6 relative z-10 ring-4 ring-white dark:ring-neutral-900">
                <step.icon className="text-[#0c6b35] dark:text-emerald-400 w-7 h-7" />
              </div>

              {/* Title */}
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                {step.title}
              </h3>

              <p className="text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
