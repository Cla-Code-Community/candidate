type Place = { city: string; state: string; country: string; extra: string[] };
const key = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
const countries: Record<string, string> = {
  brasil: "Brasil",
  brazil: "Brasil",
  br: "Brasil",
  usa: "EUA",
  us: "EUA",
  eua: "EUA",
  "united states": "EUA",
  "united states of america": "EUA",
  "estados unidos": "EUA",
  india: "Índia",
  canada: "Canadá",
  portugal: "Portugal",
  germany: "Alemanha",
  alemanha: "Alemanha",
  france: "França",
  franca: "França",
  spain: "Espanha",
  espanha: "Espanha",
  "united kingdom": "Reino Unido",
  uk: "Reino Unido",
  "reino unido": "Reino Unido",
};
function stateAliases(country: string) {
  const definitions =
    country === "Brasil"
      ? "São Paulo:SP|Rio de Janeiro:RJ|Minas Gerais:MG|Santa Catarina:SC|Paraná:PR|Rio Grande do Sul:RS|Bahia:BA|Pernambuco:PE|Distrito Federal:DF|Ceará:CE"
      : country === "EUA"
        ? "Texas:TX|California:CA|New York:NY|Washington:WA|Florida:FL|Illinois:IL|Massachusetts:MA|Georgia:GA|Indiana:IN|New Jersey:NJ|Colorado:CO|Virginia:VA"
        : "";
  return new Map(
    definitions
      .split("|")
      .filter(Boolean)
      .flatMap((entry) => {
        const [name, code] = entry.split(":");
        return [
          [key(name), code],
          [key(code), code],
        ];
      }),
  );
}
const compatible = (a: Place, b: Place) =>
  key(a.city) === key(b.city) &&
  (!a.state || !b.state || key(a.state) === key(b.state)) &&
  (!a.country || !b.country || a.country === b.country) &&
  (!a.extra.length ||
    !b.extra.length ||
    a.extra.map(key).join("|") === b.extra.map(key).join("|"));

/** Formatação de apresentação: não altera nem reinterpreta os valores da busca. */
export function formatJobLocation(
  location: unknown,
  structured: Record<string, unknown> = {},
) {
  const rawCountry = text(structured.country);
  const structuredCountry = countries[key(rawCountry)] || rawCountry;
  const original = text(location);
  const missing = [
    "",
    "local nao informado",
    "localizacao nao informada",
    "unknown",
    "not specified",
    "n/a",
  ].includes(key(original));
  const chunks = (missing ? "" : original).split(/[|;\n/]+/).map((chunk) =>
    chunk
      .replace(
        /\b(?:trabalho\s+remoto|home\s+office|remote|remoto|remota)\b/gi,
        "",
      )
      .replace(/\s+[-–—]\s+/g, ",")
      .split(",")
      .map((part) => part.trim().replace(/^[-–—\s]+|[-–—\s]+$/g, ""))
      .filter(Boolean),
  );
  const explicitCountries = [
    ...new Set(
      chunks.flatMap((parts) =>
        parts
          .filter((_, index) => index > 0 || parts.length === 1)
          .map((part) => countries[key(part)])
          .filter(Boolean),
      ),
    ),
  ];
  const context =
    structuredCountry ||
    (explicitCountries.length === 1 ? explicitCountries[0] : "");
  const sharedCountry = text(structured.city) ? "" : structuredCountry;
  function aliasesFor(country: string, city: string) {
    if (country) return stateAliases(country);
    // Sem país, aceitar o nome por extenso somente quando a sigla já aparece
    // para a mesma cidade. Isso não acrescenta um país nem usa aproximações.
    const codes = new Set(
      chunks
        .filter((parts) => key(parts[0] || "") === key(city))
        .flatMap((parts) => parts.slice(1))
        .filter((part) => /^[A-Z]{2,3}$/.test(part)),
    );
    if (
      key(text(structured.city)) === key(city) &&
      /^[A-Z]{2,3}$/.test(text(structured.state))
    )
      codes.add(text(structured.state));
    const aliases = new Map<string, string>();
    for (const knownCountry of ["Brasil", "EUA"]) {
      for (const [name, code] of stateAliases(knownCountry))
        if (codes.has(code)) aliases.set(name, code);
    }
    return aliases;
  }
  function normalized(place: Place): Place {
    const country = countries[key(place.country)] || place.country;
    const aliases = aliasesFor(country, place.city);
    const state = aliases.get(key(place.state)) || place.state;
    const extra = place.extra.filter(
      (value) =>
        key(value) !== key(state) &&
        (!state || aliases.get(key(value)) !== state) &&
        countries[key(value)] !== country,
    );
    return { city: place.city, state, country, extra };
  }
  function parse(parts: string[], countryFallback = sharedCountry): Place {
    const countryIndex = parts.findIndex(
      (part, index) =>
        (index > 0 || parts.length === 1) && Boolean(countries[key(part)]),
    );
    const country =
      countryIndex >= 0 ? countries[key(parts[countryIndex])] : countryFallback;
    const rest = parts.filter(
      (part, index) =>
        index !== countryIndex &&
        (index === 0 || countries[key(part)] !== country),
    );
    const city = rest[0] || "";
    const sameCityContext = chunks.some(
      (parts) =>
        key(parts[0] || "") === key(city) &&
        parts.slice(1).some((part) => countries[key(part)] === context),
    );
    const aliases = aliasesFor(
      country || (sameCityContext ? context : ""),
      city,
    );
    let state = "";
    const extra: string[] = [];
    for (const part of rest.slice(1)) {
      const code = aliases.get(key(part));
      if (code && (!state || state === code)) state = code;
      else if (
        key(part) !== key(city) &&
        !extra.some((value) => key(value) === key(part))
      )
        extra.push(part);
    }
    return normalized({ city, state, country, extra });
  }
  const places: Place[] = [];
  function add(place: Place, prefer = false) {
    place = normalized(place);
    if (!place.city && !place.state && !place.country && !place.extra.length)
      return;
    const matches = places.filter((current) =>
      compatible(normalized(current), place),
    );
    if (matches.length === 1) {
      const current = matches[0];
      if (prefer && place.city) current.city = place.city;
      current.state ||= place.state;
      current.country ||= place.country;
      if (!current.extra.length) current.extra = [...place.extra];
      Object.assign(current, normalized(current));
    } else places.push(place);
  }
  for (const parts of chunks) if (parts.length) add(parse(parts));
  const city = text(structured.city),
    state = text(structured.state);
  if (city || state) {
    const structuredPlace = normalized({
      city,
      state,
      country: structuredCountry,
      extra: [],
    });
    const represented =
      !city &&
      places.filter((place) => {
        const aliases = aliasesFor(
          structuredPlace.country || place.country,
          place.city,
        );
        const expected =
          aliases.get(key(structuredPlace.state)) || structuredPlace.state;
        const actual = aliases.get(key(place.state)) || place.state;
        return (
          place.city &&
          (!expected || key(actual) === key(expected)) &&
          (!place.country ||
            !structuredPlace.country ||
            place.country === structuredPlace.country)
        );
      });
    if (represented && represented.length > 0) {
      for (const place of represented) {
        place.country ||= structuredPlace.country;
        Object.assign(place, normalized(place));
      }
    } else add(structuredPlace, true);
  }
  const labels = [
    ...new Set(
      places
        .filter(
          (place) =>
            place.city ||
            place.state ||
            place.extra.length ||
            !places.some(
              (other) =>
                other !== place &&
                other.country === place.country &&
                Boolean(other.city || other.state),
            ),
        )
        .map((place) =>
          [place.city, place.state, ...place.extra, place.country]
            .filter(Boolean)
            .join(", "),
        ),
    ),
  ];
  return {
    primary: labels[0] || "Localização não informada",
    additional: labels.slice(1),
  };
}
