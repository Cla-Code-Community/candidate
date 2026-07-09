import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../modules/auth/hooks/useAuth";

export function Forbidden() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-950 dark:bg-[#090b0f] dark:text-white">
      <section className="w-full max-w-md space-y-5 text-center">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-purple-600 dark:text-purple-400">
            Acesso negado
          </p>
          <h1 className="text-3xl font-bold">
            Serviço indisponível para sua conta
          </h1>
          <p className="text-sm leading-6 text-slate-600 dark:text-gray-400">
            Seu usuário foi autenticado, mas não possui permissão para acessar o
            Painel Admin. Solicite acesso administrativo à equipe responsável.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-700 cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          Sair e voltar a página principal
        </button>
      </section>
    </main>
  );
}
