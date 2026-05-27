import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Menu, X, MessageSquare,
  Sparkles, Workflow, BadgeDollarSign, RadioTower, Sun, Moon,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

const navLinks = [
  {
    name: "Funcionalidades", href: "#features", sectionId: "features", icon: Sparkles
  },
  {
    name: "Como Funciona", href: "#how-it-works", sectionId: "how-it-works", icon: Workflow
  },
  {
    name: "Status", href: "#status", sectionId: "status", icon: RadioTower      },
];

export function Navbar() {
  const [isScrolledPastHero, setIsScrolledPastHero] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen]     = useState(false);
  const [activeSection, setActiveSection]           = useState<string>(navLinks[0].name);
  const { theme, toggleTheme } = useTheme();

  const isDark = theme === "dark";

  useEffect(() => {
    const root = document.documentElement;
    isDark ? root.classList.add("dark") : root.classList.remove("dark");
  }, [isDark]);

  useEffect(() => {
    const handleScroll = () =>
      setIsScrolledPastHero(window.scrollY > window.innerHeight * 0.8);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const visibilityMap: Record<string, number> = {};
    const observers: IntersectionObserver[] = [];

    const pickMostVisible = () => {
      const best = Object.entries(visibilityMap).reduce(
        (acc, [id, ratio]) => (ratio > acc.ratio ? { id, ratio } : acc),
        { id: "", ratio: 0 }
      );
      if (best.id) {
        const link = navLinks.find((l) => l.sectionId === best.id);
        if (link) setActiveSection(link.name);
      }
    };

    navLinks.forEach(({ sectionId }) => {
      const el = document.getElementById(sectionId);
      if (!el) return;
      visibilityMap[sectionId] = 0;
      const obs = new IntersectionObserver(
        ([entry]) => { visibilityMap[sectionId] = entry.intersectionRatio; pickMostVisible(); },
        { threshold: Array.from({ length: 21 }, (_, i) => i / 20), rootMargin: "-10% 0px -10% 0px" }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <nav
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 w-[95%] max-w-4xl ${
        isScrolledPastHero
          ? "opacity-100 translate-y-0 pointer-events-auto bg-white/80 dark:bg-[#0d1a14]/80 backdrop-blur-md border border-gray-200 dark:border-emerald-900/40 rounded-full p-1.5 shadow-xl"
          : "opacity-0 -translate-y-full pointer-events-none"
      }`}
    >
      <div className="flex items-center justify-between w-full h-11 px-3">

        <Link to="/" className="flex font-bold items-center gap-2 shrink-0 dark:text-white text-black ">
          Painel de vagas
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const Icon     = link.icon;
            const isActive = activeSection === link.name;
            return (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setActiveSection(link.name)}
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full transition-all duration-200 ${
                  isActive
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 ring-1 ring-emerald-500/30"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                <Icon
                  size={13}
                  className={isActive ? "text-emerald-500 dark:text-emerald-400" : "text-neutral-400 dark:text-neutral-500"}
                />
                {link.name}
              </a>
            );
          })}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <a
            href="#contact"
            className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 font-medium text-xs px-3 py-1.5 rounded-full transition-all hover:bg-black/5 dark:hover:bg-white/5"
          >
            Contato
          </a>

          <div className="w-[1px] h-4 bg-gray-200 dark:bg-neutral-800" />

          <Link
            to="/app"
            className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold text-xs px-4 py-1.5 h-8 rounded-full transition-all shadow-md whitespace-nowrap"
          >
            <MessageSquare size={13} />
            Acessar App
          </Link>

          <div className="w-[1px] h-4 bg-gray-200 dark:bg-neutral-800" />

          <button
            onClick={toggleTheme}
            type="button"
            aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
            className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/8 transition-all"
          >
            {isDark ? <Sun size={15}  /> : <Moon size={15}  />}
          </button>
        </div>


        <div className="md:hidden flex items-center gap-1">
          <button
            onClick={toggleTheme}
            type="button"
            className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all"
          >
            {isDark ? <Sun size={15}  /> : <Moon size={15} />}
          </button>
          <button
            className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white p-1.5 transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Abrir menu"
          >
            {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Menu mobile */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-[calc(100%+0.5rem)] left-0 w-full bg-white/95 dark:bg-[#0d1a14]/95 backdrop-blur-xl border border-gray-200 dark:border-emerald-900/30 rounded-2xl shadow-2xl p-3 flex flex-col gap-1">
          {navLinks.map((link) => {
            const Icon     = link.icon;
            const isActive = activeSection === link.name;
            return (
              <a
                key={link.name}
                href={link.href}
                className={`flex items-center gap-2.5 font-medium py-2.5 px-3 text-xs rounded-xl transition-colors ${
                  isActive
                    ? "bg-emerald-600/10 dark:bg-emerald-600/20 text-emerald-600 dark:text-emerald-300 ring-1 ring-emerald-500/30"
                    : "text-neutral-500 dark:text-neutral-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-white"
                }`}
                onClick={() => { setActiveSection(link.name); setIsMobileMenuOpen(false); }}
              >
                <Icon size={14} className={isActive ? "text-emerald-500 dark:text-emerald-400" : ""} />
                {link.name}
              </a>
            );
          })}
        </div>
      )}
    </nav>
  );
}
