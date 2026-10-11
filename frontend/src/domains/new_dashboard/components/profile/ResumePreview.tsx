import { useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  CircleAlert,
  Copy,
  User,
} from "lucide-react";
import { FaGithub as Github, FaLinkedin as Linkedin } from "react-icons/fa";
import type { AtsReport, ResumeAnalysis } from "../../infrastructure/resumeApi";

const SOURCE_LABELS: Record<string, { label: string; icon: typeof User }> = {
  candidate: { label: "Perfil", icon: User },
  github: { label: "GitHub", icon: Github },
  linkedin: { label: "LinkedIn", icon: Linkedin },
};

const BREAKDOWN_LABELS: Array<[keyof AtsReport["breakdown"], string]> = [
  ["keywords", "Palavras-chave"],
  ["experience", "Experiência"],
  ["technicalSkills", "Skills técnicas"],
  ["structure", "Estrutura"],
  ["achievements", "Conquistas"],
  ["readability", "Legibilidade"],
];

const STATUS_LABELS: Record<AtsReport["status"], string> = {
  PASSED: "Aderência textual elevada",
  NEEDS_IMPROVEMENT: "Aderência textual a melhorar",
  INSUFFICIENT_DATA: "Dados insuficientes",
};

const REQUIREMENT_LABELS: Record<string, string> = {
  required: "Obrigatório",
  preferred: "Desejável",
  responsibility: "Responsabilidade",
  education: "Formação",
  certification: "Certificação",
  behavioral: "Comportamental",
  ambiguous: "Revisar",
};

const EVIDENCE_LABELS: Record<string, string> = {
  professional_experience: "Experiência declarada",
  project: "Projeto",
  profile_mention: "Menção no perfil",
  education: "Formação",
};

function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function barColor(value: number): string {
  if (value >= 75) return "bg-emerald-500";
  if (value >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="border-b border-border pb-1 text-[13px] font-bold uppercase tracking-wide text-foreground">
        {title}
      </h3>
      <div className="mt-2 space-y-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function buildResumeMarkdown(analysis: ResumeAnalysis): string {
  const { resume } = analysis;
  const lines = [
    `# ${resume.name}`,
    resume.title,
    [resume.contact.email, resume.contact.phone, resume.contact.portfolio]
      .filter(Boolean)
      .join(" | "),
    [resume.links.linkedin, resume.links.github].filter(Boolean).join(" | "),
    "",
  ].filter((line): line is string => Boolean(line));

  if (resume.summary) lines.push("## Resumo Profissional", "", resume.summary, "");
  if (resume.experience.length) {
    lines.push("## Experiência Profissional", "");
    for (const experience of resume.experience) {
      lines.push(
        `### ${experience.empresa}${experience.cargo ? ` — ${experience.cargo}` : ""}`,
      );
      if (experience.periodo) lines.push(experience.periodo);
      if (experience.stack) lines.push(`Tecnologias: ${experience.stack}`);
      lines.push(
        ...experience.atividades.map((item) => `- ${item}`),
        ...experience.resultados.map((item) => `- ${item}`),
        "",
      );
    }
  }
  if (resume.projects.length) {
    lines.push("## Projetos", "");
    for (const project of resume.projects) {
      lines.push(`### ${project.name}`);
      if (project.url) lines.push(project.url);
      if (project.stack) lines.push(`Tecnologias: ${project.stack}`);
      if (project.description) lines.push(project.description);
      lines.push(...project.highlights.map((item) => `- ${item}`), "");
    }
  }
  if (Object.keys(resume.skills).length) {
    lines.push("## Competências Técnicas", "");
    for (const [category, skills] of Object.entries(resume.skills)) {
      lines.push(`- **${category}:** ${skills.join(", ")}`);
    }
    lines.push("");
  }
  if (resume.education.length) {
    lines.push("## Formação Acadêmica", "", ...resume.education.map((item) => `- ${item}`), "");
  }
  if (resume.languages.length) {
    lines.push("## Idiomas", "", ...resume.languages.map((item) => `- ${item}`), "");
  }
  return lines.join("\n").trim();
}

export function ResumePreview({ analysis }: { analysis: ResumeAnalysis }) {
  const { resume, atsReport, sourcesUsed, job, warnings } = analysis;
  const contactLine = [resume.contact.email, resume.contact.phone, resume.contact.portfolio]
    .filter(Boolean)
    .join("  |  ");
  const linksLine = [resume.links.linkedin, resume.links.github].filter(Boolean).join("  |  ");
  const [editedMarkdown, setEditedMarkdown] = useState(() => buildResumeMarkdown(analysis));
  const [copyMessage, setCopyMessage] = useState("");
  const requirements = atsReport.requirements ?? [];

  const [prevAnalysis, setPrevAnalysis] = useState(analysis);
  if (prevAnalysis !== analysis) {
    setPrevAnalysis(analysis);
    setEditedMarkdown(buildResumeMarkdown(analysis));
    setCopyMessage("");
  }

  const copyMarkdown = async () => {
    if (!navigator.clipboard?.writeText) {
      setCopyMessage("A cópia para a área de transferência não está disponível neste navegador.");
      return;
    }
    try {
      await navigator.clipboard.writeText(editedMarkdown);
      setCopyMessage("Currículo copiado.");
    } catch {
      setCopyMessage("Não foi possível copiar o currículo. Selecione e copie o texto manualmente.");
    }
  };

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* ── Documento (ATS-safe: coluna única, texto real, hierarquia clara) ── */}
      <article
        className="rounded-xl border border-border bg-card p-6 sm:p-8 shadow-sm"
        aria-label="Pré-visualização do currículo"
      >
        <header className="text-center">
          <h2 className="text-2xl font-bold tracking-tight">{resume.name}</h2>
          {resume.title && (
            <p className="mt-1 text-sm font-medium text-muted-foreground">{resume.title}</p>
          )}
          {contactLine && <p className="mt-2 text-xs text-foreground">{contactLine}</p>}
          {linksLine && <p className="mt-1 text-xs text-foreground">{linksLine}</p>}
        </header>

        {resume.summary && (
          <Section title="Resumo Profissional">
            <p>{resume.summary}</p>
          </Section>
        )}

        {resume.experience.length > 0 && (
          <Section title="Experiência Profissional">
            {resume.experience.map((exp, i) => (
              <div key={i} className="mb-3">
                <p className="font-semibold">
                  {exp.empresa}
                  {exp.cargo ? ` – ${exp.cargo}` : ""}
                </p>
                {(exp.periodo || exp.stack) && (
                  <p className="text-xs italic text-muted-foreground">
                    {[exp.periodo, exp.stack ? `Stack: ${exp.stack}` : ""].filter(Boolean).join("  |  ")}
                  </p>
                )}
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {exp.atividades.map((a, j) => (
                    <li key={j}>{a}</li>
                  ))}
                  {exp.resultados.map((r, j) => (
                    <li key={`r${j}`} className="text-emerald-700 dark:text-emerald-400">
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Section>
        )}

        {resume.projects.length > 0 && (
          <Section title="Projetos">
            {resume.projects.map((p, i) => (
              <div key={i} className="mb-3">
                <p className="font-semibold">{p.name}</p>
                {p.stack && <p className="text-xs italic text-muted-foreground">Stack: {p.stack}</p>}
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {p.description && <li>{p.description}</li>}
                  {p.highlights.map((h, j) => (
                    <li key={j}>{h}</li>
                  ))}
                </ul>
              </div>
            ))}
          </Section>
        )}

        {Object.keys(resume.skills).length > 0 && (
          <Section title="Habilidades Técnicas">
            {Object.entries(resume.skills).map(([cat, items]) => (
              <p key={cat}>
                <span className="font-semibold">{cat}:</span> {items.join("  |  ")}
              </p>
            ))}
          </Section>
        )}

        {resume.education.length > 0 && (
          <Section title="Formação Acadêmica">
            <ul className="list-disc space-y-0.5 pl-5">
              {resume.education.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </Section>
        )}

        {resume.languages.length > 0 && (
          <Section title="Idiomas">
            <ul className="list-disc space-y-0.5 pl-5">
              {resume.languages.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </Section>
        )}
      </article>

      {/* ── Painel de transparência / análise ATS ── */}
      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        {(job.title || atsReport.jobDetails?.title) && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
            <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden />
            Personalizado para: {job.title || atsReport.jobDetails?.title}
            {job.company || atsReport.jobDetails?.company
              ? ` · ${job.company || atsReport.jobDetails?.company}`
              : ""}
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold">ATS Score</span>
            <span className={`text-2xl font-bold ${scoreColor(atsReport.score)}`}>
              {atsReport.score}
              <span className="text-sm text-muted-foreground">/100</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{STATUS_LABELS[atsReport.status]}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Esta pontuação mede estrutura e correspondência textual; não prevê aprovação
            nem avalia objetivamente o domínio profissional.
          </p>

          <div className="mt-3 space-y-2">
            {BREAKDOWN_LABELS.map(([key, label]) => (
              <div key={key}>
                <div className="flex justify-between text-xs">
                  <span>{label}</span>
                  <span className="font-medium">{atsReport.breakdown[key]}%</span>
                </div>
                <div className="mt-0.5 h-1.5 w-full rounded-full bg-muted">
                  <div
                    className={`h-1.5 rounded-full ${barColor(atsReport.breakdown[key])}`}
                    style={{ width: `${atsReport.breakdown[key]}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {atsReport.jobFitScore !== undefined && atsReport.jobFitScore !== null && (
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold">Aderência textual à vaga</span>
              <span className={`text-xl font-bold ${scoreColor(atsReport.jobFitScore)}`}>
                {atsReport.jobFitScore}/100
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {atsReport.jobFitExplanation}
            </p>
          </div>
        )}

        {requirements.length > 0 && (
          <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h3 className="text-sm font-semibold">Requisitos identificados</h3>
            <div className="mt-3 space-y-3">
              {requirements.slice(0, 20).map((requirement, index) => (
                <article key={`${requirement.category}-${index}`} className="border-t border-border pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold">
                      {REQUIREMENT_LABELS[requirement.category] ?? requirement.category}
                      {requirement.priority === "preferred" ? " · Desejável" : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {requirement.reviewRequired
                        ? "Classificação para revisão"
                        : requirement.priority === "informational"
                          ? "Informativo"
                          : `${requirement.matchStrength}% de correspondência`}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{requirement.text}</p>
                  {requirement.technologies.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Competências: {requirement.technologies.join(", ")}
                    </p>
                  )}
                  {requirement.evidence.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {requirement.evidence.slice(0, 3).map((item, evidenceIndex) => (
                        <li key={`${item.skillId}-${item.source}-${evidenceIndex}`}>
                          {item.source} · {EVIDENCE_LABELS[item.evidenceType] ?? item.evidenceType}
                          {" · "}correspondência textual {Math.round(item.confidence * 100)}%
                          {" · “"}{item.originalExcerpt}{"”"}
                        </li>
                      ))}
                    </ul>
                  ) : requirement.priority !== "informational" && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      Nenhuma evidência correspondente foi encontrada no perfil informado.
                    </p>
                  )}
                </article>
              ))}
            </div>
            {requirements.length > 20 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Exibindo 20 de {requirements.length} itens.
              </p>
            )}
          </section>
        )}

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm font-semibold">Fontes utilizadas</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {sourcesUsed.map((s) => {
              const meta = SOURCE_LABELS[s] ?? { label: s, icon: User };
              const Icon = meta.icon;
              return (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium"
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden /> {meta.label}
                </span>
              );
            })}
          </div>
        </div>

        {atsReport.matchedKeywords.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden /> Palavras-chave atendidas
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {atsReport.matchedKeywords.slice(0, 18).map((k) => (
                <span
                  key={k}
                  className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300"
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
        )}

        {atsReport.missingKeywords.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <CircleAlert className="h-4 w-4 text-amber-600" aria-hidden /> Faltando da vaga
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {atsReport.missingKeywords.slice(0, 12).map((k) => (
                <span
                  key={k}
                  className="rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300"
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
        )}

        {atsReport.recommendations.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm font-semibold">Recomendações</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {atsReport.recommendations.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            {warnings.map((w, i) => (
              <p key={i}>{w}</p>
            ))}
          </div>
        )}
      </aside>
      </div>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Editar e copiar currículo em Markdown</h3>
            <p className="text-xs text-muted-foreground">
              Edite o texto antes de copiar. A edição é local e não altera os dados do perfil
              nem os arquivos exportados pelo gerador.
            </p>
          </div>
          <button
            type="button"
            onClick={copyMarkdown}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold hover:bg-accent"
          >
            <Copy className="h-4 w-4" aria-hidden />
            Copiar texto
          </button>
        </div>
        <textarea
          aria-label="Editar currículo em Markdown"
          value={editedMarkdown}
          onChange={(event) => setEditedMarkdown(event.target.value)}
          rows={18}
          className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-primary"
        />
        {copyMessage && (
          <p className="mt-2 text-xs text-muted-foreground" role="status">{copyMessage}</p>
        )}
      </section>
    </div>
  );
}
