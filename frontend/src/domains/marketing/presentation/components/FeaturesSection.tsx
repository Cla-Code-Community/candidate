import { Globe, Filter, Zap, Brain, Download, BriefcaseBusiness } from "lucide-react";
import { motion, Variants } from "framer-motion";

const features = [
  {
    title: "Busca Global Automatizada",
    description: "Varremos LinkedIn, Indeed, Glassdoor e dezenas de outras plataformas em segundos.",
    icon: Globe,
    colorClass: "bg-blue-50 dark:bg-blue-950/30 text-blue-500 dark:text-blue-400 group-hover:ring-blue-500/30"
  },
  {
    title: "Filtros por Tecnologia",
    description: "React, Python, Go, AWS... Filtre por stack, senioridade e modelo de trabalho.",
    icon: Filter,
    colorClass: "bg-amber-50 dark:bg-amber-950/30 text-amber-500 dark:text-amber-400 group-hover:ring-amber-500/30"
  },
  {
    title: "Atualizações em Tempo Real",
    description: "Nosso scraper roda continuamente. Receba vagas novas assim que são publicadas.",
    icon: Zap,
    colorClass: "bg-purple-50 dark:bg-purple-950/30 text-purple-500 dark:text-purple-400 group-hover:ring-purple-500/30"
  },
  {
    title: "Análise com IA",
    description: "Inteligência artificial categoriza e ranqueia as vagas com base no seu perfil.",
    icon: Brain,
    colorClass: "bg-blue-50 dark:bg-blue-950/30 text-blue-500 dark:text-blue-400 group-hover:ring-blue-500/30"
  },
  {
    title: "Exportação de Dados",
    description: "Exporte suas vagas favoritas in XLSX, CSV ou PDF para compartilhar offline.",
    icon: Download,
    colorClass: "bg-amber-50 dark:bg-amber-950/30 text-amber-500 dark:text-amber-400 group-hover:ring-amber-500/30"
  },
  {
    title: "Vagas organizadas",
    description: "Visualize tendências de mercado, salários e tecnologias mais demandadas em um só lugar.",
    icon: BriefcaseBusiness,
    colorClass: "bg-purple-50 dark:bg-purple-950/30 text-purple-500 dark:text-purple-400 group-hover:ring-purple-500/30"
  },
];

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
};

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 relative overflow-hidden bg-transparent">
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-purple-500/5 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-blue-500/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">

        <div className="text-center mb-20">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10px" }}
            transition={{ duration: 0.6 }}
            className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-4"
          >
            Tudo que você precisa para encontrar o emprego ideal
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10px" }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="text-gray-500 dark:text-gray-400 text-lg max-w-2xl mx-auto font-medium"
          >
            Nossa plataforma foi construída especificamente para simplificar o mercado de tecnologia global.
          </motion.p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {features.map((feat, index) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={index}
                variants={cardVariants}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="group p-6 rounded-2xl border border-gray-200/80 dark:border-neutral-800/70 bg-white/60 dark:bg-neutral-900/40 backdrop-blur-md hover:shadow-xl hover:shadow-gray-200/10 dark:hover:shadow-none transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-5 transition-all duration-300 ring-1 ring-transparent ${feat.colorClass}`}>
                    <Icon className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300">
                    {feat.title}
                  </h3>

                  <p className="text-gray-500 dark:text-gray-400 leading-relaxed text-sm font-medium">
                    {feat.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
