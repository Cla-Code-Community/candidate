import { describe, expect, it } from "vitest";
import type { PublicUser } from "../../../../src/modules/users/users.mapper";
import {
  getUserMatchTechnologies,
  jobNotificationIdentity,
  scoreJobWithTechnologies,
  scoreProfessionalJob,
} from "../../../../src/modules/jobs/services/jobMatch.service";

function basePublicUser(overrides: Partial<PublicUser> = {}): PublicUser {
  return {
    id: "user-1",
    firstName: null,
    lastName: null,
    displayName: null,
    username: "user",
    email: "user@example.com",
    emailVerified: false,
    avatarUrl: null,
    phone: null,
    cpf: null,
    technologies: null,
    technologyExperiences: null,
    level: null,
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

  it("extrai experiências de tecnologia do usuário (já decifradas)", () => {
    const user = basePublicUser({
      technologyExperiences: [
        { name: "TypeScript", years: 4 },
        { name: "Node.js", years: -1 },
        { name: "", years: 10 },
        null,
      ],
    });

    expect(getUserMatchTechnologies(user)).toEqual([
      { name: "TypeScript", years: 4 },
      { name: "Node.js", years: 0 },
    ]);
  });

  it("usa technologies como fallback quando não há experiências", () => {
    const user = basePublicUser({
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

describe("PAV-125 professional match", () => {
  const product = {id:"p",title:"Product Manager",description:"Discovery roadmap SQL Jira",classification:{primaryFamily:"product",seniority:"senior"},modality:"remoto",location:"Brasil"};
  const design = {...product,id:"d",title:"Product Designer",description:"UX UI pesquisa Figma design systems acessibilidade HTML CSS",classification:{primaryFamily:"product_design",seniority:"senior"}};
  it.each([product,design])("does not penalize absent development languages ($id)", job => {
    const preferences = {family:job.classification.primaryFamily,seniority:"senior",modality:"remoto",location:"Brasil"};
    expect(scoreProfessionalJob(job,[],preferences).matchScore).toBeGreaterThan(80);
    expect(scoreProfessionalJob(job,[{name:"Java",years:10}],preferences).matchScore).toBe(scoreProfessionalJob(job,[],preferences).matchScore);
  });
  it("uses product skills/tools and experience", () => {
    const matched=scoreProfessionalJob(product,[{name:"Jira",years:3},{name:"Discovery",years:2}],{family:"product"});
    expect(matched.matchedTechnologies).toEqual(["Discovery","Jira"]);
    expect(matched.matchScore).toBeGreaterThan(85);
    expect(matched.matchReasons).toContain("competências e ferramentas de Produto relacionadas");
  });
  it("uses design tools without requiring HTML/CSS", () => {
    const technologies=[{name:"Figma",years:4},{name:"UX",years:2}];
    expect(scoreProfessionalJob(design,technologies).matchScore).toBeGreaterThan(70);
    expect(scoreProfessionalJob(design,[...technologies].reverse())).toEqual(scoreProfessionalJob(design,technologies));
  });
  it("does not invent a score without profile evidence", () => {
    expect(scoreProfessionalJob(product,[])).toBe(product);
    expect(scoreProfessionalJob(product,[{name:"Java",years:10}])).toBe(product);
  });
  it.each(["backend","frontend","fullstack","mobile","data","devops","platform","qa","security","software","leadership"])("preserves %s's exact existing formula", family => {
    const job={...product,classification:{primaryFamily:family},description:"Go React PostgreSQL"};
    const technologies=[{name:"Go",years:3},{name:"React",years:2}];
    expect(scoreProfessionalJob(job,technologies,{family:"product",seniority:"senior"})).toEqual(scoreJobWithTechnologies(job,technologies));
  });
});

it("keeps HTML/CSS auxiliary for Design and canonicalizes duplicate skills", () => {
 const job={title:"Product Designer UX Figma HTML CSS",classification:{primaryFamily:"product_design"}};
 expect(scoreProfessionalJob(job,[{name:"HTML",years:20},{name:"CSS",years:20}]).matchScore).toBeLessThan(65);
 const skills=[{name:"Figma",years:0.5},{name:"Figma",years:3.5}];
 expect(scoreProfessionalJob(job,skills)).toEqual(scoreProfessionalJob(job,[...skills].reverse()));
 expect(Number.isInteger(scoreProfessionalJob(job,skills).matchScore)).toBe(true);
});
