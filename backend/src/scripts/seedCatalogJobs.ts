import type { ProfessionalFamily } from "../modules/jobs/types/professionalTaxonomy";
import { createClient } from "redis";

export type SeedTechnologyExperience = {
  name: string;
  years: number;
};

export const SEED_DEV_TECHNOLOGIES: SeedTechnologyExperience[] = [
  { name: "React", years: 5 },
  { name: "TypeScript", years: 5 },
  { name: "Node.js", years: 4 },
  { name: "PostgreSQL", years: 3 },
  { name: "Docker", years: 2 },
  { name: "AWS", years: 2 },
];


export type SeedCatalogJobSpec = {
  slug: string;
  title: string;
  company: string;
  location: string;
  place: { continent: string; country: string; state?: string; city?: string };
  modality: string;
  contract: string;
  level: string;
  seniority: string;
  family: ProfessionalFamily;
  technologies: string[];
  salary: string;
  description: string;
  postedAtDaysAgo: number;
 
  expectedMatch: number;
};


export const SEED_CATALOG_JOBS: SeedCatalogJobSpec[] = [
  {
    slug: "plataforma-fullstack-senior",
    title: "Engenheiro(a) de Software Fullstack Sênior",
    company: "Nimbus Labs",
    location: "Remoto - Brasil",
    place: { continent: "America do Sul", country: "Brasil" },
    modality: "Remoto",
    contract: "PJ",
    level: "Senior",
    seniority: "Senior",
    family: "fullstack",
    technologies: [
      "React",
      "TypeScript",
      "Node.js",
      "PostgreSQL",
      "Docker",
      "AWS",
    ],
    salary: "R$ 16.000 - R$ 21.000",
    description:
      "Squad de plataforma de um produto multi-tenant. Front em React com TypeScript, serviços em Node.js, dados em PostgreSQL, empacotamento com Docker e infraestrutura na AWS.",
    postedAtDaysAgo: 1,
    expectedMatch: 99,
  },
  {
    slug: "produto-fullstack-pleno",
    title: "Pessoa Desenvolvedora Fullstack Pleno",
    company: "Harbor Sistemas",
    location: "São Paulo, SP",
    place: {
      continent: "America do Sul",
      country: "Brasil",
      state: "SP",
      city: "Sao Paulo",
    },
    modality: "Híbrido",
    contract: "CLT",
    level: "Pleno",
    seniority: "Pleno",
    family: "fullstack",
    technologies: ["React", "TypeScript", "Node.js", "PostgreSQL", "Docker"],
    salary: "R$ 12.000 - R$ 15.500",
    description:
      "Evolução de um produto de assinaturas: interfaces em React e TypeScript, APIs em Node.js, modelagem em PostgreSQL e ambientes locais com Docker.",
    postedAtDaysAgo: 2,
    expectedMatch: 96,
  },
  {
    slug: "web-fullstack-produto-digital",
    title: "Desenvolvedor(a) Web Fullstack",
    company: "Praia Digital",
    location: "Remoto - Brasil",
    place: { continent: "America do Sul", country: "Brasil" },
    modality: "Remoto",
    contract: "PJ",
    level: "Pleno",
    seniority: "Pleno",
    family: "fullstack",
    technologies: ["React", "TypeScript", "Node.js", "PostgreSQL"],
    salary: "R$ 11.000 - R$ 14.000",
    description:
      "Produto de agendamentos com front em React, tipagem forte em TypeScript, backend em Node.js e persistência em PostgreSQL.",
    postedAtDaysAgo: 3,
    expectedMatch: 92,
  },
  {
    slug: "engenharia-produto-web",
    title: "Engenheiro(a) de Produto Web",
    company: "Volta Tecnologia",
    location: "Belo Horizonte, MG",
    place: {
      continent: "America do Sul",
      country: "Brasil",
      state: "MG",
      city: "Belo Horizonte",
    },
    modality: "Híbrido",
    contract: "CLT",
    level: "Pleno",
    seniority: "Pleno",
    family: "fullstack",
    technologies: ["React", "TypeScript", "Node.js"],
    salary: "R$ 10.500 - R$ 13.000",
    description:
      "Time de crescimento construindo experimentos em React e TypeScript, com serviços de apoio em Node.js e armazenamento em MySQL.",
    postedAtDaysAgo: 4,
    expectedMatch: 87,
  },
  {
    slug: "backend-servicos-distribuidos",
    title: "Desenvolvedor(a) Backend de Serviços",
    company: "Trilha Softworks",
    location: "Remoto - Brasil",
    place: { continent: "America do Sul", country: "Brasil" },
    modality: "Remoto",
    contract: "PJ",
    level: "Pleno",
    seniority: "Pleno",
    family: "backend",
    technologies: ["TypeScript", "Node.js", "Docker"],
    salary: "R$ 10.000 - R$ 13.500",
    description:
      "Serviços em Node.js com TypeScript e NestJS, mensageria com RabbitMQ, MongoDB como base principal e entrega via Docker.",
    postedAtDaysAgo: 5,
    expectedMatch: 82,
  },
  {
    slug: "frontend-interfaces-pleno",
    title: "Desenvolvedor(a) Frontend Pleno",
    company: "Estúdio Farol",
    location: "Remoto - Brasil",
    place: { continent: "America do Sul", country: "Brasil" },
    modality: "Remoto",
    contract: "PJ",
    level: "Pleno",
    seniority: "Pleno",
    family: "frontend",
    technologies: ["React", "TypeScript"],
    salary: "R$ 9.500 - R$ 12.000",
    description:
      "Construção de interfaces acessíveis em React e TypeScript, com Vite, Tailwind e testes em Vitest.",
    postedAtDaysAgo: 6,
    expectedMatch: 80,
  },
  {
    slug: "api-integracoes-backend",
    title: "Pessoa Desenvolvedora Backend de Integrações",
    company: "Ponte Pagamentos",
    location: "Curitiba, PR",
    place: {
      continent: "America do Sul",
      country: "Brasil",
      state: "PR",
      city: "Curitiba",
    },
    modality: "Presencial",
    contract: "CLT",
    level: "Pleno",
    seniority: "Pleno",
    family: "backend",
    technologies: ["Node.js", "PostgreSQL"],
    salary: "R$ 9.000 - R$ 11.500",
    description:
      "APIs de integração bancária escritas em Node.js com Express e JavaScript, usando PostgreSQL e filas internas.",
    postedAtDaysAgo: 7,
    expectedMatch: 75,
  },
  {
    slug: "infraestrutura-plataforma",
    title: "Engenheiro(a) de Infraestrutura",
    company: "Órbita Serviços",
    location: "Remoto - Brasil",
    place: { continent: "America do Sul", country: "Brasil" },
    modality: "Remoto",
    contract: "PJ",
    level: "Senior",
    seniority: "Senior",
    family: "devops",
    technologies: ["Docker", "AWS"],
    salary: "R$ 14.000 - R$ 18.000",
    description:
      "Operação de clusters Kubernetes, imagens Docker, Terraform e contas AWS para os times de produto.",
    postedAtDaysAgo: 8,
    expectedMatch: 70,
  },
  {
    slug: "frontend-interfaces-junior",
    title: "Desenvolvedor(a) Frontend Júnior",
    company: "Casa Criativa",
    location: "Remoto - Brasil",
    place: { continent: "America do Sul", country: "Brasil" },
    modality: "Remoto",
    contract: "CLT",
    level: "Junior",
    seniority: "Junior",
    family: "frontend",
    technologies: ["React"],
    salary: "R$ 4.500 - R$ 6.000",
    description:
      "Manutenção de páginas institucionais em React com JavaScript, Redux e CSS modular.",
    postedAtDaysAgo: 9,
    expectedMatch: 67,
  },
  {
    slug: "administracao-banco-dados",
    title: "Administrador(a) de Banco de Dados",
    company: "Serra Consultoria",
    location: "Porto Alegre, RS",
    place: {
      continent: "America do Sul",
      country: "Brasil",
      state: "RS",
      city: "Porto Alegre",
    },
    modality: "Híbrido",
    contract: "CLT",
    level: "Pleno",
    seniority: "Pleno",
    family: "data",
    technologies: ["PostgreSQL"],
    salary: "R$ 9.000 - R$ 12.000",
    description:
      "Tuning, replicação e rotinas de backup em PostgreSQL sobre Linux, com monitoramento via Zabbix.",
    postedAtDaysAgo: 10,
    expectedMatch: 64,
  },
  {
    slug: "confiabilidade-plataforma",
    title: "Analista de Confiabilidade (SRE)",
    company: "Campo Aberto Tech",
    location: "Remoto - Brasil",
    place: { continent: "America do Sul", country: "Brasil" },
    modality: "Remoto",
    contract: "PJ",
    level: "Pleno",
    seniority: "Pleno",
    family: "devops",
    technologies: ["Docker"],
    salary: "R$ 11.000 - R$ 14.000",
    description:
      "Observabilidade com Prometheus e Grafana, empacotamento em Docker e orquestração em Kubernetes na Google Cloud.",
    postedAtDaysAgo: 11,
    expectedMatch: 62,
  },
  {
    slug: "analise-dados-pleno",
    title: "Analista de Dados Pleno",
    company: "Bússola Analytics",
    location: "Recife, PE",
    place: {
      continent: "America do Sul",
      country: "Brasil",
      state: "PE",
      city: "Recife",
    },
    modality: "Híbrido",
    contract: "CLT",
    level: "Pleno",
    seniority: "Pleno",
    family: "data",
    technologies: ["Python", "Pandas", "Power BI"],
    salary: "R$ 8.000 - R$ 10.500",
    description:
      "Modelagem analítica com Python e Pandas, construção de painéis em Power BI e consultas SQL em BigQuery.",
    postedAtDaysAgo: 12,
    expectedMatch: 45,
  },
];

function normalizeIndexValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\//g, " ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function catalogJobId(spec: SeedCatalogJobSpec): string {
  return `seed-${spec.slug}`;
}

export function catalogJobDocument(spec: SeedCatalogJobSpec) {
  const postedAt = new Date(
    Date.now() - spec.postedAtDaysAgo * 24 * 60 * 60 * 1000,
  ).toISOString();

  return {
    id: catalogJobId(spec),
    title: spec.title,
    company: spec.company,
    location: spec.location,
    url: `https://vagas.local/seed/${spec.slug}`,
    salary: spec.salary,
    modality: spec.modality,
    description: spec.description,
    postedAt,
    source: "seed-local",
    sources: ["seed-local"],
    keyword: spec.technologies[0],
    keywords: spec.technologies,
    classification: {
      primaryFamily: spec.family,
      relatedFamilies: [],
      technologies: spec.technologies,
      seniority: spec.seniority,
      inScope: true,
      confidence: 1,
      reasons: ["seed local"],
    },
  };
}

/**
 * Chaves do índice invertido que o scraper normalmente escreve
 * (`IndexJobsInValkey`). Sem elas os filtros estruturados e a priorização por
 * perfil não enxergam as vagas do seed.
 */
export function catalogJobIndexKeys(spec: SeedCatalogJobSpec): string[] {
  const keys = new Set<string>();

  const add = (kind: string, value: string | undefined) => {
    const normalized = normalizeIndexValue(value ?? "");
    if (normalized) keys.add(`scraper:jobs:${kind}:${normalized}`);
  };

  for (const technology of spec.technologies) {
    add("technology", technology);
    add("keyword", technology);
  }

  add("family", spec.family);
  add("keyword", spec.family);
  add("seniority", spec.seniority);
  add("level", spec.level);
  add("model", spec.modality);
  add("contract", spec.contract);
  add("continent", spec.place.continent);
  add("country", spec.place.country);
  add("location", spec.place.country);
  add("state", spec.place.state);
  add("city", spec.place.city);

  return [...keys];
}

/** Mesmo TTL usado pelo scraper para documentos e índices invertidos. */
const CATALOG_JOB_TTL_SECONDS = 9 * 24 * 60 * 60;

/**
 * Cliente dedicado ao seed.
 *
 * O cliente compartilhado da aplicação reconecta indefinidamente, o que trava
 * o `db:seed` (e, por consequência, o container `migrate`) quando a
 * `VALKEY_URL` aponta para um host inacessível. Aqui a conexão falha na
 * primeira tentativa e o seed apenas avisa e segue.
 */
async function connectSeedCache(url: string) {
  const client = createClient({
    url,
    socket: { connectTimeout: 5000, reconnectStrategy: false },
  });

  // Sem listener o erro de conexão vira exceção não tratada no processo.
  client.on("error", () => {});

  await client.connect();
  return client;
}

export async function seedCatalogJobs(): Promise<void> {
  const url = process.env.VALKEY_URL;

  if (!url) {
    console.log(
      "! VALKEY_URL nao definida: pulando o seed das vagas da aba /vagas.",
    );
    return;
  }

  let client: Awaited<ReturnType<typeof connectSeedCache>>;
  try {
    client = await connectSeedCache(url);
  } catch (error) {
    // As vagas do catálogo são opcionais: nunca devem quebrar migrate + seed.
    console.log(
      `! Valkey indisponível em ${url} (${(error as Error).message}): pulando o seed das vagas da aba /vagas.`,
    );
    return;
  }

  try {
    if (await client.get("scraper:jobs:index-version")) {
      console.log("! Catálogo durável ativo: seed legado de vagas ignorado; indexação pertence ao Processor.");
      return;
    }
    for (const spec of SEED_CATALOG_JOBS) {
      const id = catalogJobId(spec);

      await client.set(
        `scraper:job:${id}`,
        JSON.stringify(catalogJobDocument(spec)),
        { EX: CATALOG_JOB_TTL_SECONDS },
      );
      await client.sAdd("scraper:jobs:index", id);

      for (const key of catalogJobIndexKeys(spec)) {
        await client.sAdd(key, id);
        await client.expire(key, CATALOG_JOB_TTL_SECONDS);
      }

      console.log(
        `+ vaga do catálogo indexada: ${spec.title} (match esperado=${spec.expectedMatch}%)`,
      );
    }
  } finally {
    await client.quit().catch(() => client.destroy());
  }

  const maior = SEED_CATALOG_JOBS[0].expectedMatch;
  const menor = SEED_CATALOG_JOBS[SEED_CATALOG_JOBS.length - 1].expectedMatch;
  console.log(
    `Catálogo do seed: ${SEED_CATALOG_JOBS.length} vagas, do maior (${maior}%) ao menor match (${menor}%).`,
  );
}
