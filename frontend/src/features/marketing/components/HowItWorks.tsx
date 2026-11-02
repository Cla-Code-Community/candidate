import { Settings, Bot, Rocket } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  {
    number: "PASSO 01",
    title: "Configure seus filtros",
    description: "Defina suas tecnologias preferidas, nível de senioridade, modelo de trabalho e localização desejada.",
    icon: Settings,
    themeClass: "text-blue-500 dark:text-blue-400",
    bgClass: "group-hover:bg-blue-500/10 group-hover:border-blue-500/30",
    dotClass: "border-blue-500 bg-blue-500"
  },
  {
    number: "PASSO 02",
    title: "O robô busca por você",
    description: "Nosso scraper varre dezenas de plataformas automaticamente e coleta as vagas que combinam com seu perfil.",
    icon: Bot,
    themeClass: "text-amber-500 dark:text-amber-400",
    bgClass: "group-hover:bg-amber-500/10 group-hover:border-amber-500/30",
    dotClass: "border-amber-500 bg-amber-500"
  },
  {
    number: "PASSO 03",
    title: "Receba e candidate-se",
    description: "Visualize as vagas filtradas, exporte relatórios e candidate-se com confiança.",
    icon: Rocket,
    themeClass: "text-purple-500 dark:text-purple-400",
    bgClass: "group-hover:bg-purple-500/10 group-hover:border-purple-500/30",
    dotClass: "border-purple-500 bg-purple-500"
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 relative overflow-hidden bg-transparent font-sans">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-r from-blue-500/5 via-amber-500/3 to-purple-500/5 blur-[100px] pointer-events-none rounded-full" />

      <div className="max-w-6xl mx-auto px-6 relative z-10">

        <div className="text-center mb-24">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight"
          >
            Como funciona?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="text-gray-500 dark:text-gray-400 text-lg max-w-2xl mx-auto font-medium"
          >
            Em apenas 3 passos, você está pronto para receber as melhores vagas automaticamente.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-4 relative">

          <div className="hidden md:block absolute top-[112px] left-[15%] right-[15%] h-[2px] bg-gradient-to-r from-blue-500/30 via-amber-500/30 to-purple-500/30 dark:from-blue-500/10 dark:via-amber-500/10 dark:to-purple-500/10" />

          {steps.map((step, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: idx * 0.15, ease: "easeOut" }}
              className="flex flex-col items-center text-center relative group"
            >

              <div className={`w-16 h-16 bg-white dark:bg-neutral-800 rounded-2xl flex items-center justify-center mb-8 shadow-md border border-gray-100 dark:border-neutral-700/60 relative z-10 transition-all duration-300 group-hover:-translate-y-1 ${step.bgClass}`}>
                <step.icon className={`w-6 h-6 transition-colors duration-300 ${step.themeClass}`} />
              </div>

              <div className={`hidden md:block w-3 h-3 bg-white dark:bg-neutral-900 border-2 rounded-full mb-6 relative z-10 transition-all duration-300 group-hover:scale-125 ${step.dotClass}`} />

              <span className={`text-xs font-bold tracking-widest uppercase mb-3 transition-colors duration-300 ${step.themeClass}`}>
                {step.number}
              </span>

              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-tight group-hover:text-neutral-800 dark:group-hover:text-neutral-200 transition-colors">
                {step.title}
              </h3>

              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed max-w-xs px-2 font-medium">
                {step.description}
              </p>

            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
