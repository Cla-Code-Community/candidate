import { useNotifications } from "../../../../components/notifications/useNotifications";
import type { ServiceHealth } from "../../schemas";
import { ServiceItem } from "./ServiceItem";

interface ServiceStatusProps {
  services: ServiceHealth[];
}

export function ServiceStatus({ services }: ServiceStatusProps) {
  const { notify } = useNotifications();

  return (
    <div className="bg-white dark:bg-[#0f131a] p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between theme-transition">
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
          Status dos Serviços
        </h3>
        <div className="space-y-3.5">
          {services.map((service) => (
            <ServiceItem key={service.name} service={service} />
          ))}
        </div>
      </div>

      <button
        onClick={() =>
          notify({
            tone: "success",
            title: "Serviços verificados",
            description:
              "A visão detalhada de serviços está disponível na página de Observabilidade.",
          })
        }
        className="w-full text-center text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors pt-4 mt-2 border-t border-slate-100 dark:border-slate-800"
      >
        Ver todos os serviços
      </button>
    </div>
  );
}
