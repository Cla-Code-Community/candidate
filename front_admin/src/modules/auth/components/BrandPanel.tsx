import { BarChart3, Briefcase, Users } from "lucide-react";

interface FeatureCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  iconColor: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({
  icon: Icon,
  title,
  description,
  iconColor,
}) => (
  <div
    className="
      flex items-center gap-4 p-4 rounded-xl transition-all duration-300
      bg-black/3 border border-black/5 backdrop-blur-md
      hover:border-purple-500/30 hover:bg-black/5
      dark:bg-white/3 dark:border-white/5 dark:hover:bg-white/5
    "
  >
    <div
      className={`shrink-0 w-10 h-10 rounded-lg ${iconColor} flex items-center justify-center`}
    >
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
        {title}
      </h3>
      <p className="text-xs text-slate-600 dark:text-gray-400">{description}</p>
    </div>
  </div>
);

export const BrandPanel: React.FC = () => {
  const features = [
    {
      icon: Briefcase,
      title: "Gestão Inteligente de Vagas",
      description:
        "Publique e acompanhe vagas em múltiplos países simultaneamente.",
      iconColor: "bg-blue-500/20 text-blue-400",
    },
    {
      icon: Users,
      title: "Triagem de Elite Automática",
      description:
        "Filtre perfis compatíveis por competências, idioma e geolocalização.",
      iconColor: "bg-purple-500/20 text-purple-400",
    },
    {
      icon: BarChart3,
      title: "Analytics e Compliance Global",
      description:
        "Relatórios de conversão, SLAs de contratação e segurança total de dados.",
      iconColor: "bg-emerald-500/20 text-emerald-400",
    },
  ];

  return (
    <div className="relative lg:w-1/2 min-h-100 lg:min-h-screen flex flex-col justify-between p-8 md:p-12 lg:p-16 overflow-hidden">
      {/* Overlay claro */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center transition-transform duration-1000 transform hover:scale-105 dark:hidden"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(248, 250, 252, 0.93), rgba(248, 250, 252, 0.8)), url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80')`,
        }}
      />
      {/* Overlay escuro */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center transition-transform duration-1000 transform hover:scale-105 hidden dark:block"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(13, 15, 20, 0.94), rgba(13, 15, 20, 0.82)), url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80')`,
        }}
      />

      <div className="absolute -left-32 -bottom-32 w-96 h-96 rounded-full bg-purple-600/15 blur-[128px] pointer-events-none" />
      <div className="absolute -right-32 top-32 w-96 h-96 rounded-full bg-indigo-600/10 blur-[128px] pointer-events-none" />

      <div className="relative z-10 space-y-8 my-auto max-w-xl">
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl lg:text-[44px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
            Gerenciando talentos <br />
            <span className="bg-linear-to-r from-purple-500 via-indigo-500 to-cyan-500 dark:from-purple-400 dark:via-indigo-400 dark:to-cyan-400 bg-clip-text text-transparent">
              às melhores e maiores
            </span>{" "}
            <br />
            <span className="bg-linear-to-r from-cyan-500 to-emerald-500 dark:from-cyan-400 dark:to-emerald-400 bg-clip-text text-transparent">
              oportunidades mundiais
            </span>
          </h1>
          <p className="text-slate-600 dark:text-gray-400 text-sm md:text-base leading-relaxed font-light">
            Centralizamos processos de contratação globais para ajudar sua
            equipe de recrutamento a triar, gerenciar e engajar os melhores
            talentos em tecnologia do mercado internacional.
          </p>
        </div>

        <div className="space-y-4 pt-4">
          {features.map((feature, index) => (
            <FeatureCard key={index} {...feature} />
          ))}
        </div>
      </div>

      <div className="relative z-10 flex items-center gap-4 pt-8 border-t border-black/6 dark:border-white/6 mt-12 text-slate-500 dark:text-gray-500 text-xs">
        <span className="hover:text-slate-800 dark:hover:text-gray-300 transition-colors cursor-pointer">
          Instagram
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-gray-700" />
        <span className="hover:text-slate-800 dark:hover:text-gray-300 transition-colors cursor-pointer">
          LinkedIn
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-gray-700" />
        <span className="hover:text-slate-800 dark:hover:text-gray-300 transition-colors cursor-pointer">
          Termos de Uso
        </span>
      </div>
    </div>
  );
};
