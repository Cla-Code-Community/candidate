import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { useRef } from "react";
import { Link } from "react-router-dom";
import amazonLogo from "../../assets/amazon.png";
import googleLogo from "../../assets/google.png";
import metaLogo from "../../assets/meta.svg";
import uberLogo from "../../assets/uber.png";

const COMPANIES = [
  { name: "Google", logo: googleLogo },
  { name: "Amazon", logo: amazonLogo },
  { name: "Meta", logo: metaLogo },
  { name: "Uber", logo: uberLogo },
];

const STATIC_STARS = Array.from({ length: 80 }).map((_, i) => {
  const random = (min: number, max: number) => Math.random() * (max - min) + min;
  return {
    id: i,
    top: `${random(0, 100)}%`,
    left: `${random(0, 100)}%`,
    size: random(1, 3),
    delay: random(0, 5),
    duration: random(2, 6),
  };
});

function StarsBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {STATIC_STARS.map((star) => (
        <motion.div
          key={star.id}
          className="absolute rounded-full bg-blue-900/30 dark:bg-white"
          style={{
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
          }}
          animate={{
            opacity: [0.2, 1, 0.2],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: star.duration,
            repeat: Infinity,
            delay: star.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

export function HeroSection() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "80%"]);
  const hillsY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);

  return (
    <section ref={ref} className="relative min-h-[90vh] flex flex-col items-center justify-start pt-16 md:pt-24 pb-0 overflow-hidden bg-transparent font-sans">
      <motion.div
        style={{ y: backgroundY }}
        className="absolute inset-0 pointer-events-none w-full h-[150%]
          bg-[linear-gradient(to_right,rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.03)_1px,transparent_1px)]
          dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)]
          bg-[size:60px_60px]"
      >
        <StarsBackground />
      </motion.div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-transparent blur-[120px] rounded-full pointer-events-none" />

      <motion.div style={{ y: textY }} className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-5xl md:text-7xl lg:text-[80px] font-extrabold tracking-tight text-gray-900 dark:text-white mb-8 mt-12 leading-[1.1]"
        >
          A forma mais rápida de{" "}
          <span className="bg-gradient-to-r from-blue-600 via-purple-500 to-amber-500 bg-clip-text text-transparent dark:from-blue-400 dark:via-purple-400 dark:to-amber-400">
            encontrar vagas
          </span>{" "}
          de TI no mundo
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="text-lg md:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed font-medium"
        >
          O <span className="text-blue-500 font-light">&lt;</span>
          Cand<span className="text-amber-500">!</span>Date<span className="text-purple-500">!</span>
          <span className="text-blue-500 font-light">&gt;</span> varre dezenas de plataformas automaticamente, transforma candidatos em profissionais preparados e entrega as melhores oportunidades filtradas para você.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
          <Link
            to="/login"
            className="group inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 via-purple-600 to-teal-600 hover:opacity-95 text-white font-semibold text-base py-3.5 px-8 rounded-full transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-blue-500/10"
          >
            Comece Agora
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>

          <a
            href="#how-it-works"
            className="inline-flex items-center gap-2 bg-white dark:bg-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-200 font-semibold text-base py-3.5 px-8 rounded-full border border-gray-200 dark:border-neutral-700 transition-all duration-300 hover:scale-[1.02]"
          >
            <Play className="w-4 h-4 text-blue-500 fill-current" />
            Como funciona
          </a>
        </motion.div>
      </motion.div>

      <motion.div style={{ y: hillsY }} className="relative w-full mt-auto z-10 opacity-70 dark:opacity-20">
        <svg viewBox="0 0 1440 200" className="w-full block mb-[-2px]" preserveAspectRatio="none">
          <motion.path animate={{ x: [0, -15, 0], scaleX: [1, 1.02, 1] }} transition={{ duration: 8, repeat: Infinity }} className="origin-bottom" d="M0,200 L0,120 Q180,40 360,100 Q540,160 720,80 Q900,0 1080,60 Q1260,120 1440,80 L1440,200 Z" fill="#eff6ff" /> {/* Slates para azul clarinho */}
          <motion.path animate={{ x: [0, 15, 0], scaleX: [1, 1.02, 1] }} transition={{ duration: 12, repeat: Infinity }} className="origin-bottom" d="M0,200 L0,140 Q240,60 480,120 Q720,180 960,100 Q1200,20 1440,100 L1440,200 Z" fill="#e0e7ff" /> {/* Indigo suave */}
          <motion.path animate={{ x: [0, -20, 0], scaleX: [1, 1.03, 1] }} transition={{ duration: 15, repeat: Infinity }} className="origin-bottom" d="M0,200 L0,155 Q300,90 600,140 Q900,190 1200,130 Q1350,100 1440,120 L1440,200 Z" fill="#dbeafe" /> {/* Azul sutil */}
          <motion.path animate={{ x: [0, 20, 0], scaleX: [1, 1.03, 1] }} transition={{ duration: 20, repeat: Infinity }} className="origin-bottom" d="M0,200 L0,170 Q360,120 720,160 Q1080,200 1440,150 L1440,200 Z" fill="#f3e8ff" /> {/* Roxo clarinho de base */}
        </svg>
      </motion.div>

      <div className="w-full bg-slate-50 dark:bg-neutral-900 py-8 md:py-10 relative z-20 overflow-hidden flex flex-col items-center border-y border-gray-200 dark:border-neutral-800">
        <p className="text-center text-gray-500 dark:text-neutral-400 text-sm font-medium uppercase tracking-wider mb-6 w-full px-6">
          Usado por profissionais que passaram em empresas como :
        </p>
        <div className="w-full flex overflow-hidden select-none">
          <motion.div
            animate={{ x: [0, "-33.33%"] }}
            transition={{ repeat: Infinity, ease: "linear", duration: 20 }}
            className="flex w-max gap-16 pr-16 items-center whitespace-nowrap"
          >
            {[...COMPANIES, ...COMPANIES, ...COMPANIES].map((company, index) => (
              <img
                key={`${company.name}-${index}`}
                src={company.logo}
                alt={company.name}
                className="h-8 md:h-10 w-32 md:w-40 object-contain dark:brightness-0 dark:invert opacity-70 dark:opacity-60 hover:opacity-100 transition-opacity"
              />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
