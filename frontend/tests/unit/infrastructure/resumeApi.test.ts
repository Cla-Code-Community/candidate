import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.hoisted(() => vi.fn());
vi.mock("@/shared/lib/apiClient", () => ({ api: { post } }));

import { generateResume } from "@/domains/new_dashboard/infrastructure/resumeApi";

function resolveWith(headers: Record<string, string>) {
  post.mockResolvedValueOnce({ data: new Blob(["pdf"]), headers });
}

describe("generateResume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom não implementa object URLs.
    (URL.createObjectURL as unknown) = vi.fn(() => "blob:mock");
    (URL.revokeObjectURL as unknown) = vi.fn();
  });

  it("chama o backend com responseType blob e dispara o download", async () => {
    resolveWith({
      "content-disposition": 'attachment; filename="Ana.pdf"',
      "x-ats-score": "87",
    });

    const result = await generateResume({ format: "pdf", jobTitle: "Backend" });

    expect(post).toHaveBeenCalledWith(
      "/resume/generate",
      { format: "pdf", jobTitle: "Backend" },
      { responseType: "blob" },
    );
    expect(result.filename).toBe("Ana.pdf");
    expect(result.atsScore).toBe(87);
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("usa filename de fallback quando não há Content-Disposition", async () => {
    resolveWith({});
    const result = await generateResume({ format: "docx" });
    expect(result.filename).toBe("curriculo.docx");
    expect(result.atsScore).toBeNull();
  });

  it("usa fallback quando o Content-Disposition não tem filename", async () => {
    resolveWith({ "content-disposition": "attachment" });
    const result = await generateResume({ format: "md" });
    expect(result.filename).toBe("curriculo.md");
  });

  it("retorna atsScore null quando o header não é numérico", async () => {
    resolveWith({ "x-ats-score": "abc" });
    const result = await generateResume({ format: "pdf" });
    expect(result.atsScore).toBeNull();
  });
});
