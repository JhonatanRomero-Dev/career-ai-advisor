const IBGE_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome";

export const BRAZILIAN_STATES = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
  DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão",
  MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará",
  PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima",
  SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

export function normalizeLocationSearch(value = "") {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function createLocationOption(city = "", state = "") {
  const cleanCity = String(city || "").trim();
  const cleanState = String(state || "").trim().toUpperCase();
  if (!cleanCity) return null;
  const label = cleanState ? `${cleanCity}, ${cleanState}` : cleanCity;
  return {
    city: cleanCity,
    citySearch: normalizeLocationSearch(cleanCity),
    label,
    search: normalizeLocationSearch(`${label} ${BRAZILIAN_STATES[cleanState] || ""}`),
    state: cleanState,
  };
}

export const fallbackLocationOptions = [
  ["Piraquara", "PR"], ["Piraí do Sul", "PR"], ["Piracicaba", "SP"], ["Piraju", "SP"],
  ["Pirapora", "MG"], ["Piracaia", "SP"], ["Piracanjuba", "GO"], ["Piranhas", "AL"],
  ["Curitiba", "PR"], ["São Paulo", "SP"], ["Rio de Janeiro", "RJ"], ["Belo Horizonte", "MG"],
  ["Florianópolis", "SC"], ["Rio Branco", "AC"], ["Maceió", "AL"], ["Macapá", "AP"],
  ["Manaus", "AM"], ["Salvador", "BA"], ["Fortaleza", "CE"], ["Brasília", "DF"],
  ["Vitória", "ES"], ["Goiânia", "GO"], ["São Luís", "MA"], ["Cuiabá", "MT"],
  ["Campo Grande", "MS"], ["Belém", "PA"], ["João Pessoa", "PB"], ["Recife", "PE"],
  ["Teresina", "PI"], ["Natal", "RN"], ["Porto Alegre", "RS"], ["Porto Velho", "RO"],
  ["Boa Vista", "RR"], ["Aracaju", "SE"], ["Palmas", "TO"], ["Campinas", "SP"],
  ["São José dos Pinhais", "PR"], ["Londrina", "PR"],
].map(([city, state]) => createLocationOption(city, state));

export function cityOptionsFromResponse(cityData) {
  if (!Array.isArray(cityData)) throw new Error("Não foi possível carregar as cidades.");
  const options = new Map();
  for (const city of cityData) {
    const state = city?.microrregiao?.mesorregiao?.UF?.sigla
      || city?.["regiao-imediata"]?.["regiao-intermediaria"]?.UF?.sigla || "";
    const option = createLocationOption(city?.nome || "", state);
    if (option) options.set(normalizeLocationSearch(option.label), option);
  }
  return [...options.values()];
}

export async function fetchBrazilianCityOptions() {
  const response = await fetch(IBGE_URL, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Não foi possível carregar as cidades.");
  return cityOptionsFromResponse(await response.json());
}

export function getLocationSuggestions(options = [], query = "") {
  const normalized = normalizeLocationSearch(query);
  if (normalized.length < 2) return [];
  const words = normalized.split(/[\s,/-]+/).filter(Boolean);
  return options.filter((option) => words.every((word) => option.search.includes(word)))
    .sort((a, b) => Number(b.citySearch.startsWith(normalized)) - Number(a.citySearch.startsWith(normalized))
      || a.label.localeCompare(b.label, "pt-BR"))
    .slice(0, 8);
}

export function jobLocationSuggestions(options = [], query = "", jobLocations = []) {
  const normalized = normalizeLocationSearch(query);
  if (normalized.length < 2) return [];
  const combined = new Map(options.map((option) => [normalizeLocationSearch(option.label), option]));
  for (const location of jobLocations) {
    if (typeof location !== "string" || !location.trim() || location.length > 200) continue;
    const key = normalizeLocationSearch(location);
    if (!combined.has(key)) combined.set(key, createLocationOption(location));
  }
  const cities = getLocationSuggestions([...combined.values()], query)
    .map((option) => ({ label: option.label, value: option.label }));
  const states = Object.entries(BRAZILIAN_STATES)
    .filter(([code, name]) => normalizeLocationSearch(`${name} ${code}`).includes(normalized))
    .map(([code, name]) => ({ label: `${name} (${code})`, value: code }));
  const exactState = states.filter(({ value }) => normalized === value.toLowerCase()
    || normalized === normalizeLocationSearch(BRAZILIAN_STATES[value]));
  const otherStates = states.filter((state) => !exactState.includes(state));
  return [...exactState, ...cities, ...otherStates].slice(0, 8);
}

export function matchesLocationQuery(location = "", query = "") {
  const normalizedLocation = normalizeLocationSearch(location);
  const tokens = normalizedLocation.split(/[\s,()/|•-]+/).filter(Boolean);
  let stateCodes = tokens.filter((token) => BRAZILIAN_STATES[token.toUpperCase()]);
  if (!stateCodes.length) {
    const segments = normalizedLocation.split(/[,()/|•]|\s-\s/).map((segment) => segment.trim());
    const namedStates = segments.map((segment) => Object.entries(BRAZILIAN_STATES)
      .find(([, name]) => normalizeLocationSearch(name) === segment)?.[0]).filter(Boolean);
    stateCodes = namedStates.slice(-1).map((code) => code.toLowerCase());
  }
  return normalizeLocationSearch(query).split(/[\s,()/|•-]+/).filter(Boolean)
    .every((token) => BRAZILIAN_STATES[token.toUpperCase()]
      ? stateCodes.includes(token) : normalizedLocation.includes(token));
}
