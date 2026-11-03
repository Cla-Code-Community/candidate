import {
  CardDescription,
} from "@/shared/ui/card";
import Logo from "@/shared/assets/logo-painel-vagas.svg";

export function JobsHeaderCard() {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between md:p-5">
      <div className="flex items-center gap-4">
        <div className="shrink-0">
          <img src={Logo} alt="Painel de Vagas" className="h-14 w-14 object-contain" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground md:text-2xl">Painel de Vagas</h2>
          <CardDescription className="text-sm text-muted-foreground md:text-base">
            Leitura automática dos arquivos XLSX gerados em output.
          </CardDescription>
        </div>
      </div>
    </div>
  );
}
