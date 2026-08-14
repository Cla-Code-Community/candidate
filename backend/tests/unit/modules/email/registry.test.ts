import { describe, expect, it } from "vitest";
import {
  isTemplate,
  renderTemplate,
} from "../../../../src/modules/email/templates/registry";

describe("TemplateRegistry", () => {
  describe("isTemplate", () => {
    it("reconhece 'welcome' como template válido", () => {
      expect(isTemplate("welcome")).toBe(true);
    });

    it("rejeita nome desconhecido (EMAIL-05)", () => {
      expect(isTemplate("desconhecido")).toBe(false);
    });
  });

  describe("renderTemplate", () => {
    it("renderiza 'welcome' com nome, CTA apontando para appUrl e subject (EMAIL-07)", async () => {
      const appUrl = "https://app.example.com";
      const { subject, html } = await renderTemplate("welcome", {
        name: "Maria",
        appUrl,
      });

      expect(subject).toBeTruthy();
      expect(typeof subject).toBe("string");
      expect(html).toContain("Maria");
      expect(html).toContain(`href="${appUrl}"`);
      expect(html).toContain("Acessar plataforma");
    });

    it("rejeita template desconhecido (EMAIL-05)", async () => {
      await expect(
        // @ts-expect-error nome inválido é rejeitado em runtime
        renderTemplate("desconhecido", { name: "X", appUrl: "https://x" }),
      ).rejects.toThrow();
    });
  });
});
