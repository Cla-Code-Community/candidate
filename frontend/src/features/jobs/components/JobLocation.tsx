import { MapPin, X } from "lucide-react";
import { Popover } from "radix-ui";
import { formatJobLocation } from "../utils/formatJobLocation";

export function JobLocation({
  location,
  structured,
}: {
  location: string;
  structured?: Record<string, unknown>;
}) {
  const formatted = formatJobLocation(location, structured);
  return (
    <div className="flex min-w-0 items-start gap-1.5">
      <MapPin
        aria-hidden="true"
        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent"
      />
      <div className="min-w-0">
        <span
          title={formatted.primary}
          className="block truncate text-[11px] font-medium leading-4 text-foreground"
        >
          {formatted.primary}
        </span>
        {formatted.additional.length > 0 && (
          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                type="button"
                aria-label={`Consultar ${formatted.additional.length} localidades adicionais`}
                className="mt-0.5 rounded text-[10px] font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                +{formatted.additional.length}{" "}
                {formatted.additional.length === 1 ? "local" : "locais"}
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                side="bottom"
                align="start"
                sideOffset={6}
                collisionPadding={12}
                aria-label="Localidades adicionais"
                className="z-50 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card p-3 text-card-foreground shadow-lg"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">
                    Outras localidades
                  </span>
                  <Popover.Close
                    aria-label="Fechar localidades"
                    className="rounded p-1 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X aria-hidden="true" className="h-3.5 w-3.5" />
                  </Popover.Close>
                </div>
                <ul className="max-h-48 space-y-2 overflow-y-auto text-xs">
                  {formatted.additional.map((value) => (
                    <li key={value} className="break-words">
                      {value}
                    </li>
                  ))}
                </ul>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        )}
      </div>
    </div>
  );
}
