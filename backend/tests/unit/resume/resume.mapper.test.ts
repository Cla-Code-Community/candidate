import { describe, expect, it } from "vitest";
import { toNormalizedProfile } from "../../../src/modules/resume/resume.mapper";
import type { PublicUser } from "../../../src/modules/users/users.mapper";

function baseUser(overrides: Partial<PublicUser> = {}): PublicUser {
  return {
    id: "user_1",
    firstName: "Ana",
    lastName: "Souza",
    displayName: null,
    username: "ana",
    email: "ana@example.com",
    emailVerified: true,
    avatarUrl: null,
    phone: "+55 11 90000-0000",
    cpf: null,
    technologies: ["TypeScript", "Node.js"],
    technologyExperiences: [{ name: "TypeScript", years: 5 }],
    level: "Pleno",
    role: "user",
    isBlocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
    ...overrides,
  } as unknown as PublicUser;
}

describe("toNormalizedProfile", () => {
  it("resolve o nome a partir de firstName + lastName quando não há displayName", () => {
    const profile = toNormalizedProfile(baseUser());
    expect(profile.name).toBe("Ana Souza");
  });

  it("prefere displayName quando presente", () => {
    const profile = toNormalizedProfile(baseUser({ displayName: "Ana S." }));
    expect(profile.name).toBe("Ana S.");
  });

  it("mapeia contato, headline (level) e skills com anos de experiência", () => {
    const profile = toNormalizedProfile(baseUser());
    expect(profile.contact.email).toBe("ana@example.com");
    expect(profile.contact.phone).toBe("+55 11 90000-0000");
    expect(profile.headline).toBe("Pleno");

    const ts = profile.skills.find((s) => s.name === "TypeScript");
    expect(ts?.years).toBe(5);
    expect(profile.skills.map((s) => s.name)).toContain("Node.js");
  });

  it("não inventa experiência, formação nem projetos", () => {
    const profile = toNormalizedProfile(baseUser());
    expect(profile.experience).toEqual([]);
    expect(profile.education).toEqual([]);
    expect(profile.projects).toEqual([]);
    expect(profile.summary).toBeUndefined();
  });

  it("usa fallback 'Candidato' quando não há nome nem username", () => {
    const profile = toNormalizedProfile(
      baseUser({
        firstName: null,
        lastName: null,
        displayName: null,
        username: null,
      }),
    );
    expect(profile.name).toBe("Candidato");
  });

  it("inclui tech experiences não presentes em technologies", () => {
    const profile = toNormalizedProfile(
      baseUser({
        technologies: ["TypeScript"],
        technologyExperiences: [{ name: "Go", years: 2 }],
      }),
    );
    const go = profile.skills.find((s) => s.name === "Go");
    expect(go?.years).toBe(2);
  });

  it("usa o username quando não há nome completo nem displayName", () => {
    const profile = toNormalizedProfile(
      baseUser({ firstName: null, lastName: null, displayName: null, username: "ana" }),
    );
    expect(profile.name).toBe("ana");
  });

  it("ignora technologyExperiences inválidas e arrays nulos", () => {
    const profile = toNormalizedProfile(
      baseUser({
        technologies: null as unknown as string[],
        technologyExperiences: [
          { name: "X" } as unknown as { name: string; years: number },
          null as unknown as { name: string; years: number },
          { name: "Node.js", years: 3 },
        ],
      }),
    );
    expect(profile.skills.map((s) => s.name)).toEqual(["Node.js"]);
  });

  it("omite headline, email e phone quando ausentes", () => {
    const profile = toNormalizedProfile(
      baseUser({ level: null, email: null, phone: null }),
    );
    expect(profile.headline).toBeUndefined();
    expect(profile.contact.email).toBeUndefined();
    expect(profile.contact.phone).toBeUndefined();
  });

  it("lida com technologyExperiences não sendo um array", () => {
    const profile = toNormalizedProfile(
      baseUser({
        technologies: ["TypeScript"],
        technologyExperiences: null as unknown as { name: string; years: number }[],
      }),
    );
    expect(profile.skills.map((s) => s.name)).toEqual(["TypeScript"]);
    expect(profile.skills[0].years).toBeUndefined();
  });
});
