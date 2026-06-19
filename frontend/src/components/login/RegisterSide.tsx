/* eslint-disable @typescript-eslint/no-explicit-any */
import { register, getGoogleAuthUrl, getGithubAuthUrl, getLinkedinAuthUrl } from "@/services/authService";
import { Image } from "@unpic/react";
import { motion } from "framer-motion";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { FormEvent, useState } from "react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";

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
  
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const url = await getGoogleAuthUrl();
      window.location.href = url;
    } catch {
      setIsLoading(false);
    }
  };

  const handleGithubLogin = async () => {
    setIsLoading(true);
    setApiError("");
    try {
      const url = await getGithubAuthUrl();
      window.location.href = url;
    } catch (err: any) {
      setApiError(err.message || "Erro ao iniciar login com Github.");
      setIsLoading(false);
    }
  };

  const handleLinkedinLogin = async () => {
    setIsLoading(true);
    setApiError("");
    try {
      const url = await getLinkedinAuthUrl();
      window.location.href = url;
    } catch (err: any) {
      setApiError(err.message || "Erro ao iniciar login com LinkedIn.");
      setIsLoading(false);
    }
  };

  const handleRevealPassword = () => setShowPassword((prev) => !prev);

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setNomeError("");
    setEmailError("");
    setTelefoneError("");
    setPasswordError("");
    setCpfError("");
    setApiError("");

    let isValid = true;

    if (!nome) { 
      setNomeError("O campo de nome é obrigatório."); 
      isValid = false; 
    }

    if (!email) {
      setEmailError("O campo de e-mail é obrigatório."); 
      isValid = false;
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) { 
        setEmailError("Por favor, insira um e-mail válido."); 
        isValid = false; 
      }
    }

    if (!telefone) { 
      setTelefoneError("O campo de telefone é obrigatório."); 
      isValid = false; 
    }

    if (!password) {
      setPasswordError("O campo de senha é obrigatório."); 
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError("A senha precisa conter pelo menos 6 caracteres."); 
      isValid = false;
    }

    if (cpf && cpf.replace(/\D/g, "").length > 0 && cpf.replace(/\D/g, "").length !== 11) {
      setCpfError("CPF inválido. Deve conter 11 dígitos.");
      isValid = false;
    }

    if (isValid) {
      setIsLoading(true);
      try {
        await register({
          email: email,
          password: password,
          name: nome,
        });
        window.location.href = "/login?registered=true";
      } catch (error: any) {
        console.error("Erro no cadastro:", error);
        setApiError(error.message || "Erro ao cadastrar. Tente novamente.");
      } finally {
        setIsLoading(false);
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
          <a href="/login" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors group">
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
        {apiError && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="text-sm text-red-600 dark:text-red-400 text-center">{apiError}</p>
          </div>
        )}
        <div>
          <label htmlFor="nome" className="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-1.5">Nome</label>
          <input id="nome" type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="benevanio" disabled={isLoading} className={`w-full px-4 py-3.5 rounded-xl border bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 transition-all shadow-sm ${nomeError ? "border-red-500 focus:ring-red-500" : "border-gray-200 dark:border-neutral-700 focus:ring-blue-500 focus:border-transparent"} ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`} />
          {nomeError && <p className="mt-1.5 text-xs text-red-500 font-medium">{nomeError}</p>}
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-1.5">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="benevanio@dev.com.br" disabled={isLoading} className={`w-full px-4 py-3.5 rounded-xl border bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 transition-all shadow-sm ${emailError ? "border-red-500 focus:ring-red-500" : "border-gray-200 dark:border-neutral-700 focus:ring-blue-500 focus:border-transparent"} ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`} />
          {emailError && <p className="mt-1.5 text-xs text-red-500 font-medium">{emailError}</p>}
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-1.5">Telefone</label>
          <div className={`flex rounded-xl border bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm shadow-sm overflow-hidden transition-all focus-within:ring-2 ${telefoneError ? "border-red-500 focus-within:ring-red-500" : "border-gray-200 dark:border-neutral-700 focus-within:ring-blue-500"} ${isLoading ? "opacity-50" : ""}`}>
            <PhoneInput international defaultCountry="BR" value={telefone} onChange={setTelefone} disabled={isLoading} className="w-full px-4 py-3.5 text-gray-900 dark:text-white bg-transparent focus:outline-none phone-input-custom" placeholder="(34) 23456-7890" />
          </div>
          {telefoneError && <p className="mt-1.5 text-xs text-red-500 font-medium">{telefoneError}</p>}
        </div>
        <div>
          <label htmlFor="senha" className="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-1.5">Senha</label>
          <div className="relative">
            <input id="senha" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Ex: ••••••••••••" disabled={isLoading} className={`w-full px-4 py-3.5 rounded-xl border bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 transition-all shadow-sm ${passwordError ? "border-red-500 focus:ring-red-500" : "border-gray-200 dark:border-neutral-700 focus:ring-blue-500 focus:border-transparent"} ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`} />
            <button type="button" onClick={handleRevealPassword} disabled={isLoading} className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 dark:text-neutral-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {passwordError && <p className="mt-1.5 text-xs text-red-500 font-medium">{passwordError}</p>}
        </div>
        <div>
          <label htmlFor="cpf" className="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-1.5">CPF <span className="text-gray-400 dark:text-neutral-500 text-xs font-normal">(opcional)</span></label>
          <input id="cpf" type="text" value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} placeholder="091.000.000-00" disabled={isLoading} className={`w-full px-4 py-3.5 rounded-xl border bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 transition-all shadow-sm ${cpfError ? "border-red-500 focus:ring-red-500" : "border-gray-200 dark:border-neutral-700 focus:ring-blue-500 focus:border-transparent"} ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`} />
          {cpfError && <p className="mt-1.5 text-xs text-red-500 font-medium">{cpfError}</p>}
        </div>
        <motion.button type="submit" disabled={isLoading} whileHover={{ scale: isLoading ? 1 : 1.01 }} whileTap={{ scale: isLoading ? 1 : 0.99 }} className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-teal-600 hover:opacity-95 text-white py-3.5 px-4 rounded-xl font-bold text-base focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-md shadow-blue-500/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
          {isLoading ? "Cadastrando..." : "Cadastrar"}
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
          <button type="button" onClick={handleGoogleLogin} disabled={isLoading} className="flex justify-center items-center py-3 px-4 border border-gray-200 dark:border-neutral-800 rounded-xl bg-white/50 dark:bg-neutral-800/50 hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-all shadow-sm cursor-pointer disabled:opacity-50">
            <Image src="/google.png" alt="Google" width={20} height={20} className="object-contain" />
          </button>
          <button type="button" onClick={handleLinkedinLogin} disabled={isLoading} aria-label="LinkedIn" className="flex justify-center items-center py-3 px-4 border border-gray-200 dark:border-neutral-800 rounded-xl bg-white/50 dark:bg-neutral-800/50 hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-all shadow-sm cursor-pointer disabled:opacity-50">
            <svg className="h-5 w-5 fill-[#0A66C2]" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          </button>
          <button type="button" onClick={handleGithubLogin} disabled={isLoading} className="flex justify-center items-center py-3 px-4 border border-gray-200 dark:border-neutral-800 rounded-xl bg-white/50 dark:bg-neutral-800/50 hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-all shadow-sm cursor-pointer disabled:opacity-50">
            <svg className="h-5 w-5 fill-gray-900 dark:fill-white transition-colors" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </button>
        </div>
      </div>
    </main>
  );
}