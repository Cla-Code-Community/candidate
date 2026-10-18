import { useState } from "react";
import {
  Briefcase,
  FileText,
  GraduationCap,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { FaGithub as Github, FaLinkedin as Linkedin } from "react-icons/fa";
import { Eye } from "lucide-react";
import { isApiError } from "@/shared/lib/apiError";
import {
  analyzeResume,
  renderResume,
  type EducationInput,
  type ExperienceInput,
  type ResumeAnalysis,
  type ResumeFormat,
} from "../../infrastructure/resumeApi";
import { ResumePreview } from "./ResumePreview";

interface ExperienceRow {
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
}

const emptyExperience: ExperienceRow = {
  company: "",
  role: "",
  startDate: "",
  endDate: "",
  current: false,
  description: "",
};

interface EducationRow {
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  current: boolean;
}

const emptyEducation: EducationRow = {
  institution: "",
  degree: "",
  field: "",
  startDate: "",
  endDate: "",
  current: false,
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
      case "VALIDATION_ERROR": {
        const fields = error.details ? Object.keys(error.details) : [];
        const detail = fields.length
          ? ` Campos com problema: ${fields.join(", ")}.`
          : "";
        return `${error.message || "Dados inválidos para gerar o currículo."}${detail}`;
      }
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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [about, setAbout] = useState("");
  const [experiences, setExperiences] = useState<ExperienceRow[]>([]);
  const [educations, setEducations] = useState<EducationRow[]>([]);
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
        startDate: e.startDate || undefined,
        endDate: e.current ? undefined : e.endDate || undefined,
        current: e.current || undefined,
        description: e.description.trim() || undefined,
      }));

    const cleanedEducations: EducationInput[] = educations
      .filter((e) => e.institution.trim())
      .map((e) => ({
        institution: e.institution.trim(),
        degree: e.degree.trim() || undefined,
        field: e.field.trim() || undefined,
        startDate: e.startDate || undefined,
        endDate: e.current ? undefined : e.endDate || undefined,
        current: e.current || undefined,
      }));

    return {
      name: name.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      portfolio: portfolio.trim() || undefined,
      jobTitle: jobTitle.trim() || undefined,
      jobDescription: jobDescription.trim() || undefined,
      githubUrl: githubUrl.trim() || undefined,
      linkedinUrl: linkedinUrl.trim() || undefined,
      about: about.trim() || undefined,
      experiences: cleanedExperiences.length ? cleanedExperiences : undefined,
      education: cleanedEducations.length ? cleanedEducations : undefined,
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
    value: string | boolean,
  ) =>
    setExperiences((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );

  const addEducation = () =>
    setEducations((rows) => [...rows, { ...emptyEducation }]);
  const removeEducation = (index: number) =>
    setEducations((rows) => rows.filter((_, i) => i !== index));
  const updateEducation = (
    index: number,
    field: keyof EducationRow,
    value: string | boolean,
  ) =>
    setEducations((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );

  const handleGenerate = async () => {
    setStatus({ kind: "loading" });
    try {
      // O download apenas renderiza o conteúdo que a IA já produziu na
      // pré-visualização. Se ainda não houver preview, roda a análise uma vez.
      let data = analysis;
      if (!data) {
        data = await analyzeResume(buildParams());
        setAnalysis(data);
      }
      const result = await renderResume({
        resume: data.resume,
        format,
        atsScore: data.atsReport?.score ?? null,
      });
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
          <FileText className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-[18px] font-bold leading-tight">
            Gerar currículo via ATS-forge
          </h2>
          <p className="text-xs text-muted-foreground">
            Gera um currículo otimizado para ATS com seu nome, a vaga e seus
            perfis públicos de GitHub e LinkedIn. A pontuação ATS é calculada
            por regras determinísticas; quando a IA está habilitada, ela aprimora
            apenas a redação do conteúdo, sempre validada contra suas evidências.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Nome completo</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Bene Tesla"
            className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="seu.email@exemplo.com"
            className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Telefone</span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+55 11 90000-0000"
            className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Portfólio (opcional)</span>
          <input
            value={portfolio}
            onChange={(event) => setPortfolio(event.target.value)}
            placeholder="https://seu-portfolio.com"
            className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </label>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Os dados pessoais acima têm precedência sobre o perfil salvo e aparecem no
        cabeçalho do currículo. Preencha o nome e o e-mail para evitar placeholders.
      </p>

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
            <span className="font-normal text-muted-foreground">(recomendado)</span>
          </span>
          <button
            type="button"
            onClick={addExperience}
            aria-label="Adicionar experiência"
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-semibold hover:bg-accent"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden /> Adicionar
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Este é o principal campo do currículo: adicione suas experiências reais com
          empresa, cargo e as datas de início e término de cada trabalho. Marque
          "Trabalho atual" quando ainda estiver no cargo. Se você ainda não tem
          experiência profissional, pode deixar em branco.
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
                <div className="mt-2 grid gap-3 md:grid-cols-2">
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
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Data de início</span>
                    <input
                      type="date"
                      value={exp.startDate}
                      onChange={(e) => updateExperience(index, "startDate", e.target.value)}
                      className="h-9 rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Data de término</span>
                    <input
                      type="date"
                      value={exp.endDate}
                      disabled={exp.current}
                      min={exp.startDate || undefined}
                      onChange={(e) => updateExperience(index, "endDate", e.target.value)}
                      className="h-9 rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-primary disabled:opacity-50"
                    />
                  </label>
                </div>
                <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={exp.current}
                    onChange={(e) => updateExperience(index, "current", e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border"
                  />
                  Trabalho atual (sem data de término)
                </label>
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

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <GraduationCap className="h-4 w-4" aria-hidden /> Formação acadêmica
            <span className="font-normal text-muted-foreground">(recomendado)</span>
          </span>
          <button
            type="button"
            onClick={addEducation}
            aria-label="Adicionar formação"
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-semibold hover:bg-accent"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden /> Adicionar
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Adicione suas formações acadêmicas (graduação, pós, técnico) com
          instituição, grau, curso e as datas de início e término. Marque "Cursando"
          quando ainda estiver em andamento. Se não tiver, pode deixar em branco.
        </p>

        {educations.length > 0 && (
          <div className="mt-3 flex flex-col gap-4">
            {educations.map((edu, index) => (
              <div
                key={index}
                className="rounded-lg border border-border bg-background p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Formação {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeEducation(index)}
                    className="text-muted-foreground hover:text-red-600"
                    aria-label="Remover formação"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <div className="mt-2 grid gap-3 md:grid-cols-3">
                  <input
                    value={edu.institution}
                    onChange={(e) => updateEducation(index, "institution", e.target.value)}
                    placeholder="Instituição"
                    className="h-9 rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                  />
                  <input
                    value={edu.degree}
                    onChange={(e) => updateEducation(index, "degree", e.target.value)}
                    placeholder="Grau (ex.: Bacharelado)"
                    className="h-9 rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                  />
                  <input
                    value={edu.field}
                    onChange={(e) => updateEducation(index, "field", e.target.value)}
                    placeholder="Curso / Área (ex.: Ciência da Computação)"
                    className="h-9 rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Data de início</span>
                    <input
                      type="date"
                      value={edu.startDate}
                      onChange={(e) => updateEducation(index, "startDate", e.target.value)}
                      className="h-9 rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Data de término</span>
                    <input
                      type="date"
                      value={edu.endDate}
                      disabled={edu.current}
                      min={edu.startDate || undefined}
                      onChange={(e) => updateEducation(index, "endDate", e.target.value)}
                      className="h-9 rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-primary disabled:opacity-50"
                    />
                  </label>
                </div>
                <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={edu.current}
                    onChange={(e) => updateEducation(index, "current", e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border"
                  />
                  Cursando (sem data de término)
                </label>
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
                <FileText className="h-4 w-4" aria-hidden />
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
