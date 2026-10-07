import { useState } from "react";
import {
  Briefcase,
  FileText,
  Github,
  Linkedin,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Eye } from "lucide-react";
import { isApiError } from "@/shared/lib/apiError";
import {
  analyzeResume,
  generateResume,
  type ExperienceInput,
  type ResumeAnalysis,
  type ResumeFormat,
} from "../../infrastructure/resumeApi";
import { ResumePreview } from "./ResumePreview";

interface ExperienceRow {
  company: string;
  role: string;
  period: string;
  description: string;
}

const emptyExperience: ExperienceRow = {
  company: "",
  role: "",
  period: "",
  description: "",
};

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; atsScore: number | null; filename: string }
  | { kind: "error"; message: string };

function friendlyError(error: unknown): string {
  if (isApiError(error)) {
    switch (error.code) {
      case "UNAUTHORIZED":
        return "Sua sessão expirou. Entre novamente para gerar o currículo.";
      case "VALIDATION_ERROR":
        return "Não há dados suficientes para gerar o currículo. Preencha seu perfil ou informe um GitHub público.";
      case "NOT_FOUND":
        return "Perfil não encontrado.";
      case "INTERNAL_ERROR":
        return "O serviço de geração de currículos está indisponível. Tente novamente em instantes.";
      default:
        return "Não foi possível gerar o currículo agora. Tente novamente em instantes.";
    }
  }
  return "Não foi possível gerar o currículo agora. Tente novamente em instantes.";
}

function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function GenerateResumeCard() {
  const [format, setFormat] = useState<ResumeFormat>("pdf");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [about, setAbout] = useState("");
  const [experiences, setExperiences] = useState<ExperienceRow[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [preview, setPreview] = useState<"idle" | "loading" | "error">("idle");
  const [previewError, setPreviewError] = useState("");

  const isLoading = status.kind === "loading";

  const buildParams = () => {
    const cleanedExperiences: ExperienceInput[] = experiences
      .filter((e) => e.company.trim() && e.role.trim())
      .map((e) => ({
        company: e.company.trim(),
        role: e.role.trim(),
        period: e.period.trim() || undefined,
        description: e.description.trim() || undefined,
      }));

    return {
      jobTitle: jobTitle.trim() || undefined,
      jobDescription: jobDescription.trim() || undefined,
      githubUrl: githubUrl.trim() || undefined,
      linkedinUrl: linkedinUrl.trim() || undefined,
      about: about.trim() || undefined,
      experiences: cleanedExperiences.length ? cleanedExperiences : undefined,
    };
  };

  const handlePreview = async () => {
    setPreview("loading");
    setPreviewError("");
    try {
      const result = await analyzeResume(buildParams());
      setAnalysis(result);
      setPreview("idle");
    } catch (error) {
      setPreview("error");
      setPreviewError(friendlyError(error));
    }
  };

  const addExperience = () =>
    setExperiences((rows) => [...rows, { ...emptyExperience }]);
  const removeExperience = (index: number) =>
    setExperiences((rows) => rows.filter((_, i) => i !== index));
  const updateExperience = (
    index: number,
    field: keyof ExperienceRow,
    value: string,
  ) =>
    setExperiences((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );

  const handleGenerate = async () => {
    setStatus({ kind: "loading" });
    try {
      const result = await generateResume({ format, ...buildParams() });
      setStatus({
        kind: "success",
        atsScore: result.atsScore,
        filename: result.filename,
      });
    } catch (error) {
      setStatus({ kind: "error", message: friendlyError(error) });
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-[18px] font-bold leading-tight">
            Gerar currículo via ATS-forge
          </h2>
          <p className="text-xs text-muted-foreground">
            Gera um currículo otimizado para ATS com seu nome, a vaga e seus
            perfis públicos de GitHub e LinkedIn.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Cargo desejado (opcional)</span>
          <input
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
            placeholder="Ex.: Desenvolvedor Backend Node.js"
            className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Formato</span>
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value as ResumeFormat)}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          >
            <option value="pdf">PDF</option>
            <option value="docx">Word (DOCX)</option>
            <option value="md">Markdown</option>
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <Github className="h-4 w-4" aria-hidden /> GitHub (perfil público)
          </span>
          <input
            value={githubUrl}
            onChange={(event) => setGithubUrl(event.target.value)}
            placeholder="https://github.com/seu-usuario"
            className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <Linkedin className="h-4 w-4" aria-hidden /> LinkedIn (perfil público)
          </span>
          <input
            value={linkedinUrl}
            onChange={(event) => setLinkedinUrl(event.target.value)}
            placeholder="https://www.linkedin.com/in/seu-perfil"
            className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </label>
      </div>

      <label className="mt-5 flex flex-col gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Linkedin className="h-4 w-4" aria-hidden /> Resumo / Sobre (cole o "Sobre" do seu LinkedIn)
        </span>
        <textarea
          value={about}
          onChange={(event) => setAbout(event.target.value)}
          placeholder="Cole aqui o texto da seção 'Sobre' do seu LinkedIn. O sistema gera um resumo curto e direcionado à vaga a partir dele."
          rows={4}
          maxLength={4000}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </label>

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <Briefcase className="h-4 w-4" aria-hidden /> Experiência profissional
          </span>
          <button
            type="button"
            onClick={addExperience}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-semibold hover:bg-accent"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden /> Adicionar
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Adicione suas experiências reais (ex.: as do seu LinkedIn). Elas aparecem
          como experiência profissional no currículo.
        </p>

        {experiences.length > 0 && (
          <div className="mt-3 flex flex-col gap-4">
            {experiences.map((exp, index) => (
              <div
                key={index}
                className="rounded-lg border border-border bg-background p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Experiência {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeExperience(index)}
                    className="text-muted-foreground hover:text-red-600"
                    aria-label="Remover experiência"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <div className="mt-2 grid gap-3 md:grid-cols-3">
                  <input
                    value={exp.company}
                    onChange={(e) => updateExperience(index, "company", e.target.value)}
                    placeholder="Empresa"
                    className="h-9 rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                  />
                  <input
                    value={exp.role}
                    onChange={(e) => updateExperience(index, "role", e.target.value)}
                    placeholder="Cargo"
                    className="h-9 rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                  />
                  <input
                    value={exp.period}
                    onChange={(e) => updateExperience(index, "period", e.target.value)}
                    placeholder="Período (ex.: 2021 – Atual)"
                    className="h-9 rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                  />
                </div>
                <textarea
                  value={exp.description}
                  onChange={(e) => updateExperience(index, "description", e.target.value)}
                  placeholder="Atividades e resultados (uma por linha). Ex.: Desenvolvi APIs REST com Node.js reduzindo o tempo de resposta em 30%."
                  rows={3}
                  className="mt-3 w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <label className="mt-5 flex flex-col gap-2">
        <span className="text-sm font-semibold">
          Descrição da vaga (opcional)
        </span>
        <textarea
          value={jobDescription}
          onChange={(event) => setJobDescription(event.target.value)}
          placeholder="Cole aqui a descrição da vaga para otimizar as palavras-chave e calcular o ATS Score."
          rows={5}
          maxLength={12000}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </label>

      {status.kind === "success" && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm">
          <FileText className="h-4 w-4 text-primary" aria-hidden />
          <span>
            Currículo gerado: <strong>{status.filename}</strong>
          </span>
          {status.atsScore !== null && (
            <span className="ml-auto font-semibold">
              ATS Score:{" "}
              <span className={scoreColor(status.atsScore)}>
                {status.atsScore}/100
              </span>
            </span>
          )}
        </div>
      )}

      {status.kind === "error" && (
        <p className="mt-5 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {status.message}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          O ATS Score é uma estimativa e não garante aprovação na vaga.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handlePreview}
            disabled={isLoading || preview === "loading"}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-border px-5 text-sm font-semibold transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {preview === "loading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Analisando...
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" aria-hidden />
                Pré-visualizar
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" aria-hidden />
                Gerar e baixar
              </>
            )}
          </button>
        </div>
      </div>

      {preview === "loading" && (
        <div className="mt-6 animate-pulse space-y-3" aria-label="Carregando pré-visualização">
          <div className="h-32 rounded-xl bg-muted" />
          <div className="h-48 rounded-xl bg-muted" />
        </div>
      )}

      {preview === "error" && (
        <p className="mt-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {previewError}
        </p>
      )}

      {preview === "idle" && analysis && <ResumePreview analysis={analysis} />}
    </section>
  );
}
