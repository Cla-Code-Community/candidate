import { useState, FormEvent } from "react";
import { Eye, EyeOff, ArrowLeft, Github, Linkedin } from "lucide-react";
import { Image } from "@unpic/react";
import { motion } from "framer-motion";
import PhoneInput from "react-phone-number-input";

import { api } from "@/services/api";
import "react-phone-number-input/style.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

interface ValidationError {
  _errors?: string[];
}

const STATIC_STARS = Array.from({ length: 40 }).map((_, i) => {
  const random = (min: number, max: number) => Math.random() * (max - min) + min;
  return {
    id: i,
    top: `${random(0, 100)}%`,
    left: `${random(0, 100)}%`,
    size: random(1, 3),
    delay: random(0, 5),
    duration: random(2, 6),
  };
});

function StarsBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {STATIC_STARS.map((star) => (
        <motion.div
          key={star.id}
          className="absolute rounded-full bg-blue-900/20 dark:bg-white"
          style={{
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
          }}
          animate={{
            opacity: [0.1, 0.8, 0.1],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: star.duration,
            repeat: Infinity,
            delay: star.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

export default function RegisterSide() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState<string | undefined>("");
  const [password, setPassword] = useState("");
  const [cpf, setCpf] = useState("");

  const [nomeError, setNomeError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [telefoneError, setTelefoneError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [cpfError, setCpfError] = useState("");
  const [globalError, setGlobalError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRevealPassword = () => setShowPassword((prev) => !prev);

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const handleOAuthLogin = async (provider: "google" | "github" | "linkedin") => {
    try {
      setGlobalError("");
      setIsSubmitting(true);

      const response = await api.get(`/auth/${provider}/url`);

      if (response.data?.url) {
        window.location.href = response.data.url;
      } else {
        throw new Error("URL de redirecionamento não retornada pelo servidor.");
      }
    } catch (error: unknown) {
      console.error("Erro ao iniciar fluxo OAuth:", error);

      let apiError = `Não foi possível conectar ao provedor ${provider}.`;

      // Verifica de forma segura se o erro contém um objeto response vindo do Axios
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as { response?: { data?: { error?: string } } };
        if (typeof axiosError.response?.data?.error === "string") {
          apiError = axiosError.response.data.error;
        }
      }

      setGlobalError(apiError);
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setNomeError("");
    setEmailError("");
    setTelefoneError("");
    setPasswordError("");
    setCpfError("");
    setGlobalError("");

    let isValid = true;

    if (!nome) { setNomeError("O campo de nome é obrigatório."); isValid = false; }

    if (!email) {
      setEmailError("O campo de e-mail é obrigatório."); isValid = false;
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) { setEmailError("Por favor, insira um e-mail válido."); isValid = false; }
    }

    if (!telefone) { setTelefoneError("O campo de telefone é obrigatório."); isValid = false; }

    if (!password) {
      setPasswordError("O campo de senha é obrigatório."); isValid = false;
    } else if (password.length < 6) {
      setPasswordError("A senha precisa conter pelo menos 6 caracteres."); isValid = false;
    }

    if (!cpf) {
      setCpfError("O campo de CPF é obrigatório."); isValid = false;
    } else if (cpf.replace(/\D/g, "").length < 11) {
      setCpfError("Por favor, insira um CPF válido."); isValid = false;
    }

    if (!isValid) return;

    setIsSubmitting(true);

    try {
      // 1. Cadastra o usuário
      await api.post("/auth/register", {
        name: nome,
        email,
        phone: telefone,
        password,
        cpf: cpf.replace(/\D/g, ""),
      });

      // 2. Loga automaticamente após cadastro — popula o AuthContext corretamente
      await login({ email, password });

      // 3. Redireciona para o app
      navigate("/app");

    } catch (error: unknown) {
      console.error("Erro na requisição de cadastro:", error);
      setIsSubmitting(false);

      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as {
          response?: {
            data?: {
              error?: string | Record<string, ValidationError>;
              message?: string;
            };
          };
        };

        const data = axiosError.response?.data;

        if (data && typeof data.error === "object") {
          const validationErrors = data.error as Record<string, ValidationError>;

          if (validationErrors.name?._errors?.[0]) setNomeError(validationErrors.name._errors[0]);
          if (validationErrors.email?._errors?.[0]) setEmailError(validationErrors.email._errors[0]);
          if (validationErrors.phone?._errors?.[0]) setTelefoneError(validationErrors.phone._errors[0]);
          if (validationErrors.password?._errors?.[0]) setPasswordError(validationErrors.password._errors[0]);
          if (validationErrors.cpf?._errors?.[0]) setCpfError(validationErrors.cpf._errors[0]);
        } else {
          const fallbackMsg = data?.message || (typeof data?.error === "string" ? data.error : "") || "Erro ao efetuar o cadastro.";
          if (fallbackMsg.toLowerCase().includes("email")) {
            setEmailError("Este endereço de e-mail já está em uso.");
          } else {
            setGlobalError(fallbackMsg);
          }
        }
      } else {
        setGlobalError("Ocorreu um erro inesperado de conexão.");
      }
    }
  };

  return (
    <main className="relative flex w-full lg:w-1/2 flex-col justify-between px-6 py-10 sm:px-12 lg:px-16 xl:px-20 bg-white dark:bg-neutral-900 min-h-screen transition-colors duration-300 font-sans overflow-hidden">

      <div className="absolute inset-0 pointer-events-none w-full h-full opacity-40 dark:opacity-100">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[500px] bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-transparent blur-[100px] rounded-full" />
        <StarsBackground />
      </div>

      <div className="relative z-10 w-full max-w-2xl mx-auto flex flex-col items-center gap-8">
        <div className="w-full self-start">
          <a
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors group"
          >
            <ArrowLeft className="h-4 w-4 transform group-hover:-translate-x-1 transition-transform" />
            Voltar para o login
          </a>
        </div>

        <div className="text-center w-full">
          <h2 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center justify-center gap-1 select-none">
            <span className="text-blue-500 font-light">&lt;</span>
            Cand<span className="text-amber-500">!</span>Date<span className="text-purple-500">!</span>
            <span className="text-blue-500 font-light">&gt;</span>
          </h2>
          <p className="mt-4 text-sm text-gray-500 dark:text-neutral-400 font-medium">
            Já tem conta?{" "}
            <a href="/login" className="font-semibold bg-gradient-to-r from-blue-600 to-purple-500 bg-clip-text text-transparent dark:from-blue-400 dark:to-purple-400 underline underline-offset-2 hover:opacity-80 transition-opacity">
              Entrar
            </a>
          </p>
        </div>
      </div>

      <form className="relative z-10 space-y-5 w-full max-w-2xl mx-auto my-8" onSubmit={handleSubmit}>

        {globalError && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/30 text-red-500 rounded-xl text-sm font-semibold text-center backdrop-blur-sm">
            {globalError}
          </div>
        )}

        <div>
          <label htmlFor="nome" className="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-1.5">
            Nome
          </label>
          <input
            id="nome"
            type="text"
            disabled={isSubmitting}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Bene Santos"
            className={`w-full px-4 py-3.5 rounded-xl border bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 transition-all shadow-sm ${
              nomeError ? "border-red-500 focus:ring-red-500" : "border-gray-200 dark:border-neutral-700 focus:ring-blue-500 focus:border-transparent"
            }`}
          />
          {nomeError && <p className="mt-1.5 text-xs text-red-500 font-medium">{nomeError}</p>}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-1.5">
            Email
          </label>
          <input
            id="email"
            type="email"
            disabled={isSubmitting}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="lbene17@gmail.com"
            className={`w-full px-4 py-3.5 rounded-xl border bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 transition-all shadow-sm ${
              emailError ? "border-red-500 focus:ring-red-500" : "border-gray-200 dark:border-neutral-700 focus:ring-blue-500 focus:border-transparent"
            }`}
          />
          {emailError && <p className="mt-1.5 text-xs text-red-500 font-medium">{emailError}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-1.5">
            Telefone
          </label>
          <div className={`flex rounded-xl border bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm shadow-sm overflow-hidden transition-all focus-within:ring-2 ${
            telefoneError ? "border-red-500 focus-within:ring-red-500" : "border-gray-200 dark:border-neutral-700 focus-within:ring-blue-500"
          }`}>
            <PhoneInput
              international
              defaultCountry="BR"
              disabled={isSubmitting}
              value={telefone}
              onChange={setTelefone}
              className="w-full px-4 py-3.5 text-gray-900 dark:text-white bg-transparent focus:outline-none phone-input-custom"
              placeholder="(34) 23456-7890"
            />
          </div>
          {telefoneError && <p className="mt-1.5 text-xs text-red-500 font-medium">{telefoneError}</p>}
        </div>

        <div>
          <label htmlFor="senha" className="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-1.5">
            Senha
          </label>
          <div className="relative">
            <input
              id="senha"
              type={showPassword ? "text" : "password"}
              disabled={isSubmitting}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ex: ••••••••••••"
              className={`w-full px-4 py-3.5 rounded-xl border bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 transition-all shadow-sm ${
                passwordError ? "border-red-500 focus:ring-red-500" : "border-gray-200 dark:border-neutral-700 focus:ring-blue-500 focus:border-transparent"
              }`}
            />
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleRevealPassword}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 dark:text-neutral-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {passwordError && <p className="mt-1.5 text-xs text-red-500 font-medium">{passwordError}</p>}
        </div>

        <div>
          <label htmlFor="cpf" className="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-1.5">
            CPF
          </label>
          <input
            id="cpf"
            type="text"
            disabled={isSubmitting}
            value={cpf}
            onChange={(e) => setCpf(formatCpf(e.target.value))}
            placeholder="091.000.000-00"
            className={`w-full px-4 py-3.5 rounded-xl border bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 transition-all shadow-sm ${
              cpfError ? "border-red-500 focus:ring-red-500" : "border-gray-200 dark:border-neutral-700 focus:ring-blue-500 focus:border-transparent"
            }`}
          />
          {cpfError && <p className="mt-1.5 text-xs text-red-500 font-medium">{cpfError}</p>}
        </div>

        <motion.button
          type="submit"
          disabled={isSubmitting}
          whileHover={{ scale: isSubmitting ? 1 : 1.01 }}
          whileTap={{ scale: isSubmitting ? 1 : 0.99 }}
          className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-teal-600 hover:opacity-95 text-white py-3.5 px-4 rounded-xl font-bold text-base focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-md shadow-blue-500/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Cadastrando..." : "Cadastrar"}
        </motion.button>
      </form>

      <div className="relative z-10 w-full max-w-2xl mx-auto">
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-neutral-800" />
          </div>
          <div className="relative flex justify-center text-xs text-gray-400 dark:text-neutral-500 uppercase select-none">
            <span className="bg-white dark:bg-neutral-900 px-4 font-semibold tracking-wider">Ou cadastre-se com</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleOAuthLogin("google")}
            className="flex justify-center items-center py-3 px-4 border border-gray-200 dark:border-neutral-800 rounded-xl bg-white/50 dark:bg-neutral-800/50 hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Image src="/google.png" alt="Google" width={20} height={20} className="object-contain" />
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleOAuthLogin("linkedin")}
            className="flex justify-center items-center py-3 px-4 border border-gray-200 dark:border-neutral-800 rounded-xl bg-white/50 dark:bg-neutral-800/50 hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Linkedin className="h-5 text-blue-500" />
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleOAuthLogin("github")}
            className="flex justify-center items-center py-3 px-4 border border-gray-200 dark:border-neutral-800 rounded-xl bg-white/50 dark:bg-neutral-800/50 hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Github className="h-5 text-gray-900 dark:text-white" />
          </button>
        </div>
      </div>

    </main>
  );
}
