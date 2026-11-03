import { useLayoutEffect, useRef, useState } from "react";
import { Popover } from "radix-ui";
import { X } from "lucide-react";

const tagClassName =
  "shrink-0 whitespace-nowrap rounded border border-input bg-background px-1.5 py-0.5 font-mono text-[9px] leading-3 text-foreground";

export function TechnologyTags({ technologies }: { technologies: string[] }) {
  const lineRef = useRef<HTMLDivElement>(null);
  const measurementRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(technologies.length);

  useLayoutEffect(() => {
    let active = true;
    const measure = () => {
      const line = lineRef.current;
      const measurement = measurementRef.current;
      if (!active || !line || !measurement) return;
      const available = line.getBoundingClientRect().width;
      if (available <= 0) return;
      const widths = Array.from(
        measurement.querySelectorAll<HTMLElement>("[data-tag-width]"),
        (tag) => tag.getBoundingClientRect().width,
      );
      const gap = Number.parseFloat(getComputedStyle(line).columnGap) || 6;
      const total =
        widths.reduce((sum, width) => sum + width, 0) +
        Math.max(0, widths.length - 1) * gap;
      let count = widths.length;
      if (total > available) {
        const counter =
          measurement
            .querySelector<HTMLElement>("[data-overflow-width]")
            ?.getBoundingClientRect().width ?? 0;
        let used = counter;
        count = 0;
        for (const width of widths) {
          if (used + gap + width > available) break;
          used += gap + width;
          count++;
        }
      }
      setVisibleCount((current) => (current === count ? current : count));
    };
    measure();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    if (lineRef.current) observer?.observe(lineRef.current);
    window.addEventListener("resize", measure);
    void document.fonts?.ready.then(measure);
    return () => {
      active = false;
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [technologies]);

  const count = Math.min(visibleCount, technologies.length);
  const remaining = technologies.slice(count);

  return (
    <Popover.Root>
      <div
        className="relative mt-2 min-w-0"
        aria-label="Tecnologias e palavras-chave"
      >
        <div
          ref={lineRef}
          data-technology-line
          className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden"
        >
          {technologies.slice(0, count).map((technology) => (
            <span key={technology} className={tagClassName}>
              {technology}
            </span>
          ))}
          {remaining.length > 0 && (
            <Popover.Trigger asChild>
              <button
                type="button"
                aria-label={`Mostrar ${remaining.length} tecnologias e palavras-chave restantes`}
                className={`${tagClassName} font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring`}
              >
                +{remaining.length}
              </button>
            </Popover.Trigger>
          )}
        </div>
        <div
          ref={measurementRef}
          aria-hidden="true"
          className="pointer-events-none invisible absolute left-0 top-0 flex w-max gap-1.5"
        >
          {technologies.map((technology) => (
            <span
              key={technology}
              data-tag-width
              data-label={technology}
              className={`${tagClassName} after:content-[attr(data-label)]`}
            />
          ))}
          <span
            data-overflow-width
            data-label={`+${technologies.length}`}
            className={`${tagClassName} font-semibold after:content-[attr(data-label)]`}
          />
        </div>
      </div>
      {remaining.length > 0 && (
        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="start"
            sideOffset={6}
            collisionPadding={12}
            aria-label="Tecnologias e palavras-chave restantes"
            className="z-50 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card p-3 text-card-foreground shadow-lg outline-none"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold">
                Outras tecnologias e palavras-chave
              </span>
              <Popover.Close
                aria-label="Fechar tecnologias restantes"
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </Popover.Close>
            </div>
            <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
              {remaining.map((technology) => (
                <span
                  key={technology}
                  className="max-w-full break-words rounded border border-input bg-background px-1.5 py-1 font-mono text-[10px] text-foreground"
                >
                  {technology}
                </span>
              ))}
            </div>
          </Popover.Content>
        </Popover.Portal>
      )}
    </Popover.Root>
  );
}
