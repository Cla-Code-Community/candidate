import type { Job } from "../types";

export const continentOptions = [
  "Todos",
  "América do Norte",
  "América do Sul",
  "Europa",
  "Ásia",
  "África",
  "Oceania",
  "Global / Remoto",
] as const;

export const countryOptions = [
  "Todos",
  "Brasil",
  "Estados Unidos",
  "Canadá",
  "México",
  "Argentina",
  "Chile",
  "Colômbia",
  "Portugal",
  "Espanha",
  "Reino Unido",
  "França",
  "Alemanha",
  "Países Baixos",
  "Índia",
  "Singapura",
  "Austrália",
  "Nova Zelândia",
  "África do Sul",
] as const;

export type ContinentFilter = (typeof continentOptions)[number];
export type CountryFilter = (typeof countryOptions)[number];

const continentKeywords: Record<Exclude<ContinentFilter, "Todos">, string[]> = {
  "América do Norte": [
    "united states",
    "estados unidos",
    "usa",
    "canada",
    "canadá",
    "mexico",
    "méxico",
  ],
  "América do Sul": [
    "brazil",
    "brasil",
    "argentina",
    "chile",
    "colombia",
    "colômbia",
    "peru",
    "uruguay",
    "paraguay",
    "bolivia",
    "ecuador",
    "venezuela",
  ],
  Europa: [
    "portugal",
    "spain",
    "españa",
    "espanha",
    "france",
    "frança",
    "germany",
    "alemania",
    "reino unido",
    "united kingdom",
    "uk",
    "netherlands",
    "países baixos",
    "holanda",
    "italy",
    "irlanda",
    "poland",
    "switzerland",
    "belgium",
    "austria",
    "sweden",
    "norway",
    "denmark",
    "finland",
  ],
  "Ásia": [
    "india",
    "singapore",
    "japan",
    "china",
    "coreia",
    "korea",
    "thailand",
    "vietnam",
    "malaysia",
    "indonesia",
    "philippines",
    "pakistan",
    "bangladesh",
  ],
  "África": [
    "south africa",
    "áfrica do sul",
    "nigeria",
    "kenya",
    "egito",
    "egypt",
    "morocco",
    "marrocos",
  ],
  Oceania: ["australia", "austrália", "new zealand", "nova zelândia"],
  "Global / Remoto": ["remote", "remoto", "global", "worldwide"],
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function getContinentFromLocation(
  location: string,
): ContinentFilter | "Desconhecido" {
  const normalizedLocation = normalize(location);

  for (const [continent, keywords] of Object.entries(continentKeywords)) {
    if (keywords.some((keyword) => normalizedLocation.includes(keyword))) {
      return continent as ContinentFilter;
    }
  }

  return "Desconhecido";
}

export function matchesCountry(location: string, country: CountryFilter) {
  if (country === "Todos") return true;
  return normalize(location).includes(normalize(country));
}

export function matchesContinent(location: string, continent: ContinentFilter) {
  if (continent === "Todos") return true;
  const detected = getContinentFromLocation(location);

  if (continent === "Global / Remoto") {
    return detected === "Global / Remoto";
  }

  return detected === continent;
}

export function matchesLocationFilters(
  job: Pick<Job, "location">,
  continent: ContinentFilter,
  country: CountryFilter,
) {
  return (
    matchesContinent(job.location, continent) &&
    matchesCountry(job.location, country)
  );
}
