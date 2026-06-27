import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Menu, X,
  Sparkles, Workflow, RadioTower, Sun, Moon,
  User,
  Users2,
} from "lucide-react";
import { useTheme } from "@/shared/hooks/useTheme";

const navLinks = [
  {
    name: "Funcionalidades",
    href: "/#features",
    sectionId: "features",
    icon: Sparkles,
    activeColor: "text-blue-500 bg-blue-500/10 ring-blue-500/20 dark:text-blue-400"
  },
  {
    name: "Time",
    href: "/#time",
    sectionId: "time",
    icon: Users2,
    activeColor: "text-amber-500 bg-amber-500/10 ring-amber-500/20 dark:text-amber-400"
  },
  {
    name: "Como Funciona",
    href: "/#how-it-works",
    sectionId: "how-it-works",
    icon: Workflow,
    activeColor: "text-purple-500 bg-purple-500/10 ring-purple-500/20 dark:text-purple-400"
  },
  {
    name: "Pronto?",
    href: "/#status",
    sectionId: "status",
    icon: RadioTower,
    activeColor: "text-blue-500 bg-blue-500/10 ring-blue-500/20 dark:text-blue-400"
  },
];

export function Navbar() {
  const [isScrolledPastHero, setIsScrolledPastHero] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen]     = useState(false);
  const [activeSection, setActiveSection]           = useState<string>("");

  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = "auto";
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [isDark]);

  useEffect(() => {
    const handleScroll = () =>
      setIsScrolledPastHero(window.scrollY > 20);
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

      if (window.scrollY < 100) {
        setActiveSection("");
        return;
      }
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

  const handleNavLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string, linkName: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      e.preventDefault();
      el.scrollIntoView({ behavior: "smooth" });
      setActiveSection(linkName);
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <nav
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 w-[95%] max-w-4xl p-1.5 rounded-full ${
        isScrolledPastHero
          /* Estilo flutuante completo após scroll */
          ? "bg-white/80 dark:bg-background/80 backdrop-blur-md border border-gray-200 dark:border-border/40 shadow-xl"
          /* Estilo sutil e integrado enquanto está no topo da Hero */
          : "bg-transparent border border-transparent"
      }`}
    >
      <div className="flex items-center w-full h-11 px-4">

        {/* Logo */}
        <Link to="/" className="flex font-bold text-sm items-center gap shrink-0 dark:text-foreground text-black tracking-wide">
          <span className="text-blue-500 font-light">&lt;</span>
          Cand<span className="text-amber-500">!</span>Date<span className="text-purple-500">!</span>
          <span className="text-blue-500 font-light">&gt;</span>
        </Link>

        {/* Menu Desktop */}
        <div className={`hidden md:flex items-center gap-2 mx-auto px-2 py-1 rounded-full border transition-all duration-500 ${
          isScrolledPastHero
            ? "bg-gray-50/50 dark:bg-neutral-900/30 border-gray-100 dark:border-neutral-800/50"
            : "bg-transparent border-transparent"
        }`}>
          {navLinks.map((link) => {
            const Icon     = link.icon;
            const isActive = activeSection === link.name;
            return (
              <a
                key={link.name}
                href={link.href}
                onClick={(e) => handleNavLinkClick(e, link.sectionId, link.name)}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all duration-300 ${
                  isActive
                    ? `${link.activeColor} ring-1 font-semibold`
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                <Icon
                  size={13}
                  className={`transition-colors duration-300 ${
                    isActive ? "" : "text-neutral-400 dark:text-neutral-500"
                  }`}
                />
                {link.name}
              </a>
            );
          })}
        </div>

        <div className="hidden md:flex items-center gap-2 shrink-0">
          <Link
            to="/login"
            className="flex items-center gap-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-amber-500 hover:opacity-90 text-white font-semibold text-xs px-4 py-1.5 h-8 rounded-full transition-all shadow-md whitespace-nowrap"
          >
            <User size={13} />
            Realizar o Login
          </Link>

          <div className="w-[1px] h-4 bg-gray-200 dark:bg-neutral-800 mx-1" />

          <button
            onClick={toggleTheme}
            type="button"
            aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
            className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/8 transition-all"
          >
            {isDark ? <Sun size={15}  /> : <Moon size={15}  />}
          </button>
        </div>

        <div className="md:hidden flex items-center gap-1 ml-auto">
          <button
            onClick={toggleTheme}
            type="button"
            aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
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

      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-[calc(100%+0.5rem)] left-0 w-full bg-white/95 dark:bg-background/95 backdrop-blur-xl border border-gray-200 dark:border-border/30 rounded-2xl shadow-2xl p-3 flex flex-col gap-1 dynamic-mobile-menu">
          {navLinks.map((link) => {
            const Icon     = link.icon;
            const isActive = activeSection === link.name;
            return (
              <a
                key={link.name}
                href={link.href}
                className={`flex items-center gap-2.5 font-medium py-2.5 px-3 text-xs rounded-xl transition-all duration-300 ${
                  isActive
                    ? `${link.activeColor} ring-1 font-semibold`
                    : "text-neutral-500 dark:text-neutral-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-white"
                }`}
                onClick={(e) => handleNavLinkClick(e, link.sectionId, link.name)}
              >
                <Icon size={14} />
                {link.name}
              </a>
            );
          })}
        </div>
      )}
    </nav>
  );
}
