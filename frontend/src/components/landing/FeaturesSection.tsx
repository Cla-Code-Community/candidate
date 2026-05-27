import { Globe, Filter, Zap, Brain, Download, LayoutDashboard } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  { title: "Busca Global Automatizada", description: "Varremos LinkedIn, Indeed, Glassdoor e dezenas de outras plataformas em segundos.", icon: Globe },
  { title: "Filtros por Tecnologia", description: "React, Python, Go, AWS... Filtre por stack, senioridade e modelo de trabalho.", icon: Filter },
  { title: "Atualizações em Tempo Real", description: "Nosso scraper roda continuamente. Receba vagas novas assim que são publicadas.", icon: Zap },
  { title: "Análise com IA", description: "Inteligência artificial categoriza e ranqueia as vagas com base no seu perfil.", icon: Brain },
  { title: "Exportação de Dados", description: "Exporte suas vagas favoritas em XLSX, CSV ou PDF para compartilhar offline.", icon: Download },
  { title: "Dashboard Interativo", description: "Visualize tendências de mercado, salários e tecnologias mais demandadas.", icon: LayoutDashboard },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 relative overflow-hidden bg-transparent">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5 }}
            className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4"
          >
            Tudo que você precisa para encontrar o emprego ideal
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-gray-500 dark:text-gray-400 text-lg max-w-2xl mx-auto"
          >
            Nossa plataforma foi construída especificamente para simplificar o mercado de tecnologia global.
          </motion.p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feat, index) => (
            <div key={index} className="p-6 rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/30 backdrop-blur-sm">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center mb-4">
                <feat.icon className="text-[#0c6b35] dark:text-emerald-400 w-5 h-5" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{feat.title}</h3>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed text-sm">{feat.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
