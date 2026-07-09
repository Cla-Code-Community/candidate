import { Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CandidateLogo } from "../../app/layouts/MainLayout/components/CandidateLogo";
import { ErrorMessage } from "../../components/common/ErrorMessage";
import { BrandPanel } from "./components/BrandPanel";
import { LoginForm } from "./components/LoginForm";
import { LoginHeader } from "./components/LoginHeader";
import { useAuth } from "./hooks/useAuth";
import type { LoginCredentials } from "./schemas/auth.schema";

interface LoginPageProps {
  onBackClick?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onBackClick }) => {
  const { login, isLoading, errorMessage } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (
    credentials: LoginCredentials,
  ): Promise<boolean> => {
    const success = await login(credentials);
    if (success) {
      navigate("/dashboard", { replace: true });
    }
    return success;
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-screen">
      <BrandPanel />

      <div className="lg:w-1/2 bg-white dark:bg-[#090b0f] flex flex-col justify-between p-8 md:p-12 lg:p-16 relative">
        <div
          className="
            absolute inset-0 pointer-events-none opacity-40 dark:opacity-25
            bg-[radial-gradient(#e2e8f0_1px,transparent_1px)]
            dark:bg-[radial-gradient(#1c2130_1px,transparent_1px)]
            bg-size-[24px_24px]
          "
        />
        <div className="absolute top-1/4 right-1/4 w-80 h-80 rounded-full bg-purple-500/10 blur-[140px] pointer-events-none" />

        <LoginHeader onBackClick={onBackClick} />

        <div className="relative z-10 my-auto max-w-md w-full mx-auto space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 justify-center">
              <CandidateLogo />
              <span className="bg-linear-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-full tracking-wider shadow-lg shadow-purple-500/20">
                PORTAL ADMIN
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-gray-400">
              Painel corporativo e gestão de processos. Novo por aqui?{" "}
              <a
                href="#solicitar"
                className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-medium underline transition-all"
              >
                Solicitar acesso à diretoria
              </a>
            </p>
          </div>

          {errorMessage && <ErrorMessage message={errorMessage} />}

          <LoginForm
            onSubmit={handleSubmit}
            isLoading={isLoading}
            errorMessage={errorMessage}
          />
        </div>

        <div className="relative z-10 pt-12 border-t border-slate-200 dark:border-gray-800/80 mt-12 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 dark:text-gray-500 gap-4">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-gray-400">
            <Lock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Ambiente Administrativo Criptografado SSL</span>
          </div>
          <p>© 2026 Candidate. Todos os direitos reservados.</p>
        </div>
      </div>
    </div>
  );
};
