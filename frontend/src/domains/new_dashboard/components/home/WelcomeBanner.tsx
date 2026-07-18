import { BriefcaseBusiness, Sparkles } from "lucide-react";
import type { UserProfile } from "../../types";

interface WelcomeBannerProps {
  userProfile: UserProfile;
  jobsCount: number;
  onExploreJobs: () => void;
}

export function WelcomeBanner({
  userProfile,
  jobsCount,
  onExploreJobs,
}: WelcomeBannerProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-primary px-6 py-6 text-primary-foreground shadow-sm md:px-8 md:py-7">
      <BriefcaseBusiness className="pointer-events-none absolute -right-12 -top-14 h-80 w-80 text-white/10" />

      <div className="relative z-10 max-w-3xl space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
          <Sparkles className="h-4 w-4 text-amber-300" />
          <span>Seu Dashboard Profissional está pronto</span>
        </div>

        <h2 className="text-2xl font-extrabold leading-tight md:text-3xl">
          Que bom te ver de volta, {userProfile.displayName}!
        </h2>

        <p className="max-w-2xl text-sm leading-relaxed text-white/90 md:text-base">
          Sua conta de nível{" "}
          <strong className="text-white">{userProfile.level}</strong> monitora
          atualmente <strong className="text-white">{jobsCount}</strong>{" "}
          {jobsCount === 1 ? "vaga" : "vagas"}.
        </p>

        <div className="pt-2">
          <button
            type="button"
            onClick={onExploreJobs}
            className="rounded-lg bg-white px-5 py-2.5 text-xs font-bold text-primary shadow transition-colors hover:bg-slate-100"
          >
            Sincronizar e Buscar Oportunidades
          </button>
        </div>
      </div>
    </section>
  );
}
