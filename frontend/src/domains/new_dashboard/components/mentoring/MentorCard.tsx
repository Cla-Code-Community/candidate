import { CalendarDays, ChevronRight, Clock3, Star } from "lucide-react";
import type { Mentor } from "../../types";

interface MentorCardProps {
  mentor: Mentor;
  onOpen: (mentor: Mentor) => void;
}

export function MentorCard({ mentor, onOpen }: MentorCardProps) {
  const initials = mentor.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <article className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="grid grid-cols-[48px_minmax(0,1fr)] items-start gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${mentor.avatarColor} text-lg font-bold text-white`}>
          {initials}
        </div>
        <div className="grid min-w-0 grid-rows-[auto_40px_auto_auto_auto]">
          <h3 className="font-bold leading-tight">{mentor.name}</h3>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {mentor.specialty}
          </p>
          <div className="mt-2 flex h-5 items-center gap-1 text-emerald-600">
            {Array.from({ length: 5 }).map((_, index) => (
              <Star
                key={index}
                className="h-3.5 w-3.5"
                fill={index < mentor.rating ? "currentColor" : "none"}
              />
            ))}
          </div>
          <p className="mt-1 h-4 text-xs text-muted-foreground">
            {String(mentor.completed).padStart(2, "0")} Mentorias realizadas
          </p>
          <div className="mt-3 h-7">
            <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
              Agenda disponível
            </span>
          </div>
        </div>
      </div>

      <div className="my-5 border-t border-dashed border-border" />

      <div className="flex items-start gap-3">
        <Clock3 className="h-8 w-8 shrink-0 text-slate-400" />
        <div className="min-w-0 text-sm font-bold leading-5">
          <p className="whitespace-nowrap">{mentor.days}</p>
          <p className="mt-1 font-normal text-muted-foreground">{mentor.hours}</p>
        </div>
        <button
          type="button"
          onClick={() => onOpen(mentor)}
          className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-primary"
        >
          Ver Mais
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-lg bg-muted/45 px-3 py-3">
        <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-muted-foreground">
            Disponibilidade da próxima mentoria
          </p>
          <p className="mt-1 text-sm font-semibold">{mentor.nextSessionDate}</p>
          <p className="text-xs text-muted-foreground">
            {mentor.platform} • {mentor.hours}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onOpen(mentor)}
        className="mt-5 h-10 w-full rounded-md bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/90"
      >
        Mentorias
      </button>
    </article>
  );
}
