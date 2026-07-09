import { Eye, EyeOff } from "lucide-react";
import React, { useState } from "react";
import { ErrorMessage } from "../../../components/common/ErrorMessage";
import { Loader } from "../../../components/common/Loader";
import type { LoginCredentials } from "../schemas/auth.schema";

interface LoginFormProps {
  onSubmit: (credentials: LoginCredentials) => Promise<boolean>;
  isLoading: boolean;
  errorMessage?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSubmit,
  isLoading,
  errorMessage,
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ email, password, rememberMe });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label
          className="text-xs font-semibold text-slate-600 dark:text-gray-300 block"
          htmlFor="email"
        >
          E-mail Institucional
        </label>
        <input
          id="email"
          type="email"
          placeholder="Ex: bene17@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="
            w-full text-sm px-4 py-3 rounded-xl transition-all duration-200
            bg-white text-slate-900 placeholder-slate-400
            border border-slate-200 hover:border-slate-300
            focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none
            dark:bg-[#12151c] dark:text-white dark:placeholder-gray-500
            dark:border-gray-800 dark:hover:border-gray-700
          "
          disabled={isLoading}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <label
            className="text-xs font-semibold text-slate-600 dark:text-gray-300 block"
            htmlFor="password"
          >
            Senha de Acesso
          </label>
        </div>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Ex: ••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="
              w-full text-sm pl-4 pr-12 py-3 rounded-xl transition-all duration-200
              bg-white text-slate-900 placeholder-slate-400
              border border-slate-200 hover:border-slate-300
              focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none
              dark:bg-[#12151c] dark:text-white dark:placeholder-gray-500
              dark:border-gray-800 dark:hover:border-gray-700
            "
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-gray-500 dark:hover:text-gray-300 transition-colors p-1"
            title={showPassword ? "Esconder Senha" : "Mostrar Senha"}
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center text-xs">
        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-300">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="
              rounded text-purple-600 focus:ring-purple-500/40 focus:ring-offset-0
              border-slate-300 bg-white
              dark:border-gray-800 dark:bg-[#12151c]
            "
            disabled={isLoading}
          />
          <span>Lembre de mim</span>
        </label>
        <a
          href="#esqueci"
          className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-medium transition-colors"
        >
          Esqueceu a senha?
        </a>
      </div>

      {errorMessage && <ErrorMessage message={errorMessage} />}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full relative overflow-hidden group py-3.5 bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:from-purple-800 disabled:to-indigo-800 text-white rounded-xl text-sm font-semibold shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20 active:scale-[0.99] transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer"
      >
        {isLoading ? (
          <Loader text="Verificando credenciais..." size="sm" />
        ) : (
          <span>Entrar no Painel</span>
        )}
      </button>
    </form>
  );
};
