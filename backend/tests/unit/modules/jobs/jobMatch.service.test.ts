import { describe, expect, it } from "vitest";
import type { User } from "../../../../src/db/schema";
import { encryptText } from "../../../../src/lib/security/encryption";
import {
  getUserMatchTechnologies,
  jobNotificationIdentity,
  scoreJobWithTechnologies,
} from "../../../../src/modules/jobs/jobMatch.service";

const originalEnv = {
  ENCRYPTION_MASTER_KEY: process.env.ENCRYPTION_MASTER_KEY,
  ENCRYPTION_KEY_ID: process.env.ENCRYPTION_KEY_ID,
  SEARCH_KEY: process.env.SEARCH_KEY,
};

function setValidSecurityEnv() {
  process.env.ENCRYPTION_MASTER_KEY =
    "0000000000000000000000000000000000000000000000000000000000000000";
  process.env.ENCRYPTION_KEY_ID = "job-match-test";
  process.env.SEARCH_KEY = "job-match-search-key";
}

function baseUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    firstName: null,
    firstNameEncrypted: null,
    lastName: null,
    lastNameEncrypted: null,
    displayName: null,
    displayNameEncrypted: null,
    username: "user",
    email: "user@example.com",
    emailEncrypted: null,
    emailHash: null,
    emailVerified: false,
    avatarUrl: null,
    avatarUrlEncrypted: null,
    phone: null,
    phoneEncrypted: null,
    cpf: null,
    cpfEncrypted: null,
    cpfHash: null,
    technologies: null,
    technologiesEncrypted: null,
    technologyExperiencesEncrypted: null,
    level: null,
    levelEncrypted: null,
    role: "user",
    isBlocked: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    lastLoginAt: null,
    ...overrides,
  };
}

describe("jobMatch.service", () => {
  it("retorna lista vazia quando usuário não existe", () => {
    expect(getUserMatchTechnologies(null)).toEqual([]);
    expect(getUserMatchTechnologies(undefined)).toEqual([]);
  });

  it("extrai experiências criptografadas do usuário", () => {
    setValidSecurityEnv();

    const user = baseUser({
      technologyExperiencesEncrypted: encryptText(
        JSON.stringify([
          { name: "TypeScript", years: 4 },
          { name: "Node.js", years: -1 },
          { name: "", years: 10 },
          null,
        ]),
      ),
    });

    expect(getUserMatchTechnologies(user)).toEqual([
      { name: "TypeScript", years: 4 },
      { name: "Node.js", years: 0 },
    ]);

    process.env.ENCRYPTION_MASTER_KEY = originalEnv.ENCRYPTION_MASTER_KEY;
    process.env.ENCRYPTION_KEY_ID = originalEnv.ENCRYPTION_KEY_ID;
    process.env.SEARCH_KEY = originalEnv.SEARCH_KEY;
  });

  it("usa technologies como fallback quando não há experiências", () => {
    const user = baseUser({
      technologies: ["React", " ", "Node.js"],
    });

    expect(getUserMatchTechnologies(user)).toEqual([
      { name: "React", years: 1 },
      { name: "Node.js", years: 1 },
    ]);
  });

  it("mantém a vaga sem score quando o perfil não tem tecnologias", () => {
    const job = { title: "Backend Engineer" };

    expect(scoreJobWithTechnologies(job, [])).toBe(job);
  });

  it("calcula match com alias Node.js, pesos por anos e arrays do job", () => {
    const result = scoreJobWithTechnologies(
      {
        title: "Backend Engineer",
        keywords: ["nodejs", "api"],
        description: "APIs com TypeScript",
      },
      [
        { name: "Node.js", years: 3 },
        { name: "TypeScript", years: 2 },
        { name: "React", years: 1 },
      ],
    );

    expect(result.matchSource).toBe("backend_profile");
    expect(result.matchedTechnologies).toEqual(["Node.js", "TypeScript"]);
    expect(result.matchScore).toBeGreaterThanOrEqual(85);
  });

  it("retorna score base quando nenhuma tecnologia bate", () => {
    const result = scoreJobWithTechnologies(
      { title: "Product Manager" },
      [{ name: "Go", years: 5 }],
    );

    expect(result.matchScore).toBe(45);
    expect(result.matchedTechnologies).toEqual([]);
  });

  it("resolve identidade da notificação por url, jobLink ou id", () => {
    expect(jobNotificationIdentity({ url: " https://job.test/1 " })).toBe(
      "https://job.test/1",
    );
    expect(jobNotificationIdentity({ jobLink: "https://job.test/2" } as any)).toBe(
      "https://job.test/2",
    );
    expect(jobNotificationIdentity({ id: "job-3" })).toBe("job-3");
  });
});
