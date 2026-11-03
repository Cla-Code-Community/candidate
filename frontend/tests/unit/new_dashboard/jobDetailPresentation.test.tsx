import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  formatJobPublicationDate,
  jobDetailLabel,
  normalizeDescriptionText,
  formatCompatibilityReason,
} from "@/features/jobs/utils/jobDetailPresentation";
import { FormattedJobDescription } from "@/features/jobs/components/FormattedJobDescription";

describe("apresentação dos detalhes da vaga", () => {
  it.each([
    ["2026-10-28", "28/10/2026"],
    ["2026-10-28T10:00:00-03:00", "28/10/2026 às 10:00"],
    ["2026-10-28T23:40:00Z", "28/10/2026 às 23:40"],
    ["2026-10-28T00:05:00+05:30", "28/10/2026 às 00:05"],
    ["2026-02-30", "Data não informada"],
    ["2026-10-28T28:00:00Z", "Data não informada"],
    ["inválida", "Data não informada"],
    [undefined, "Data não informada"],
  ])("formata a publicação %s sem inventar horário", (value, expected) => {
    expect(formatJobPublicationDate(value)).toBe(expected);
  });
  it.each([
    ["match", "Compatibilidade"],
    ["matchScore", "Índice de compatibilidade"],
    ["matchSource", "Origem da compatibilidade"],
    ["keyword", "Palavra-chave"],
    ["matchedTechnologies", "Tecnologias correspondentes"],
    ["matchReasons", "Justificativas da compatibilidade"],
    ["postedAt", "Publicado em"],
    ["publishedAt", "Publicado em"],
    ["additionalDetails", "Detalhes adicionais"],
  ])("traduz o rótulo %s", (value, expected) =>
    expect(jobDetailLabel(value)).toBe(expected),
  );
  it("preserva idioma, parágrafos, listas, tecnologias e espaços de código", () => {
    const description =
      "<p>About   us&nbsp; &amp; benefits</p><p>Salary:  $5000</p><ul><li>React</li><li>TypeScript</li></ul><pre><code>  npm   test</code></pre>";
    const { container } = render(
      <FormattedJobDescription description={description} />,
    );
    expect(container.querySelectorAll("p")).toHaveLength(2);
    expect(screen.getByText("About us & benefits")).toBeInTheDocument();
    expect(screen.getByText("Salary: $5000")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(container.querySelector("code")?.textContent).toBe("  npm   test");
    expect(description).toContain("About   us&nbsp;");
    expect(
      normalizeDescriptionText(
        "  Benefits   offered\n\n\n  Remote work",
      ).trim(),
    ).toBe("Benefits offered\n\nRemote work");
    expect(formatCompatibilityReason("titulo: product manager")).toBe(
      "Título: product manager",
    );
    expect(formatCompatibilityReason("English reason about React")).toBe(
      "English reason about React",
    );
  });
});
