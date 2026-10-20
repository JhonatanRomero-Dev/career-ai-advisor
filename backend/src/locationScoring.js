const STATE_INFO = {
  AC: { name: "acre", region: "norte" },
  AL: { name: "alagoas", region: "nordeste" },
  AP: { name: "amapa", region: "norte" },
  AM: { name: "amazonas", region: "norte" },
  BA: { name: "bahia", region: "nordeste" },
  CE: { name: "ceara", region: "nordeste" },
  DF: { name: "distrito federal", region: "centro-oeste" },
  ES: { name: "espirito santo", region: "sudeste" },
  GO: { name: "goias", region: "centro-oeste" },
  MA: { name: "maranhao", region: "nordeste" },
  MT: { name: "mato grosso", region: "centro-oeste" },
  MS: { name: "mato grosso do sul", region: "centro-oeste" },
  MG: { name: "minas gerais", region: "sudeste" },
  PA: { name: "para", region: "norte" },
  PB: { name: "paraiba", region: "nordeste" },
  PR: { name: "parana", region: "sul" },
  PE: { name: "pernambuco", region: "nordeste" },
  PI: { name: "piaui", region: "nordeste" },
  RJ: { name: "rio de janeiro", region: "sudeste" },
  RN: { name: "rio grande do norte", region: "nordeste" },
  RS: { name: "rio grande do sul", region: "sul" },
  RO: { name: "rondonia", region: "norte" },
  RR: { name: "roraima", region: "norte" },
  SC: { name: "santa catarina", region: "sul" },
  SP: { name: "sao paulo", region: "sudeste" },
  SE: { name: "sergipe", region: "nordeste" },
  TO: { name: "tocantins", region: "norte" }
};

const STATE_NAME_TO_UF = Object.fromEntries(
  Object.entries(STATE_INFO).map(([uf, info]) => [info.name, uf])
);

const REMOTE_TERMS = [
  "remoto",
  "remote",
  "home office",
  "homeoffice",
  "anywhere",
  "worldwide",
  "global",
  "latam",
  "latin america",
  "america latina",
  "brasil todo",
  "todo brasil"
];

const HYBRID_TERMS = [
  "hibrido",
  "hybrid",
  "modelo hibrido",
  "trabalho hibrido"
];

const ONSITE_TERMS = [
  "presencial",
  "on-site",
  "onsite"
];

const RELOCATION_TERMS = [
  "disponivel para mudar",
  "disponivel para mudanca",
  "disponivel para relocation",
  "disponivel para realocacao",
  "disponivel para viagens",
  "disponivel para viajar",
  "mobilidade",
  "flexibilidade geografica",
  "aceita mudanca",
  "aceita relocacao"
];

const METRO_GROUPS = [
  {
    id: "sao-paulo",
    label: "regiao metropolitana de sao paulo",
    cities: [
      "sao paulo",
      "guarulhos",
      "osasco",
      "santo andre",
      "sao bernardo do campo",
      "sao caetano do sul",
      "diadema",
      "maua",
      "carapicuiba",
      "taboao da serra",
      "embu das artes",
      "cotia",
      "itapevi",
      "barueri",
      "santana de parnaiba",
      "jundiai",
      "campinas",
      "sumare",
      "hortolandia",
      "americana",
      "indaiatuba",
      "piracicaba",
      "sorocaba",
      "sao jose dos campos",
      "jacarei",
      "taubate",
      "santos",
      "sao vicente",
      "praia grande",
      "cubatao"
    ]
  },
  {
    id: "rio-de-janeiro",
    label: "regiao metropolitana do rio de janeiro",
    cities: [
      "rio de janeiro",
      "niteroi",
      "sao goncalo",
      "duque de caxias",
      "nova iguacu",
      "belford roxo",
      "sao joao de meriti",
      "mage",
      "itaborai",
      "marica",
      "petropolis",
      "cabo frio"
    ]
  },
  {
    id: "belo-horizonte",
    label: "regiao metropolitana de belo horizonte",
    cities: [
      "belo horizonte",
      "contagem",
      "betim",
      "nova lima",
      "ribeirao das neves",
      "sabara",
      "santa luzia",
      "vespasiano",
      "lagoa santa",
      "sete lagoas",
      "divinopolis"
    ]
  },
  {
    id: "curitiba",
    label: "regiao metropolitana de curitiba",
    cities: [
      "curitiba",
      "sao jose dos pinhais",
      "araucaria",
      "campo largo",
      "colombo",
      "fazenda rio grande",
      "pinhais",
      "almirante tamandare",
      "piraquara",
      "quatro barras"
    ]
  },
  {
    id: "porto-alegre",
    label: "regiao metropolitana de porto alegre",
    cities: [
      "porto alegre",
      "canoas",
      "gravatai",
      "viamao",
      "novo hamburgo",
      "sao leopoldo",
      "alvorada",
      "cachoeirinha",
      "sapucaia do sul",
      "esteio"
    ]
  },
  {
    id: "florianopolis",
    label: "regiao metropolitana de florianopolis",
    cities: [
      "florianopolis",
      "sao jose",
      "palhoca",
      "biguacu",
      "santo amaro da imperatriz",
      "santo antonio de lisboa"
    ]
  },
  {
    id: "salvador",
    label: "regiao metropolitana de salvador",
    cities: [
      "salvador",
      "lauro de freitas",
      "camaçari",
      "camaçari",
      "simoes filho",
      "candeias",
      "dias d'avila",
      "dias d avila"
    ]
  },
  {
    id: "recife",
    label: "regiao metropolitana do recife",
    cities: [
      "recife",
      "olinda",
      "jaboatao dos guararapes",
      "cabo de santo agostinho",
      "camaragibe",
      "paulista"
    ]
  },
  {
    id: "fortaleza",
    label: "regiao metropolitana de fortaleza",
    cities: [
      "fortaleza",
      "caucaia",
      "maracanau",
      "aquiraz",
      "eusebio",
      "pacatuba"
    ]
  },
  {
    id: "brasilia",
    label: "regiao metropolitana de brasilia",
    cities: [
      "brasilia",
      "aguas claras",
      "taguatinga",
      "ceilandia",
      "samambaia",
      "guara",
      "sobradinho",
      "gama",
      "planaltina"
    ]
  },
  {
    id: "goiania",
    label: "regiao metropolitana de goiania",
    cities: [
      "goiania",
      "aparecida de goiania",
      "senador canedo",
      "trindade",
      "anhanguera"
    ]
  }
];

const CITY_TO_METRO = new Map(
  METRO_GROUPS.flatMap((group) => group.cities.map((city) => [city, group]))
);

function normalizeLocationText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values = []) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function hasTerm(text, term) {
  const normalizedText = normalizeLocationText(text);
  const normalizedTerm = normalizeLocationText(term);

  if (!normalizedTerm) {
    return false;
  }

  if ((` ${normalizedText} `).includes(` ${normalizedTerm} `)) {
    return true;
  }

  if (normalizedTerm.includes(" ")) {
    return false;
  }

  const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`).test(normalizedText);
}

function stripLocationNoise(value = "") {
  return normalizeLocationText(value)
    .replace(/^(regiao metropolitana de|area metropolitana de|regiao imediata de|regiao intermediaria de|rm de|rm|grande) /, "")
    .replace(/^(cidade de|municipio de|capital de) /, "")
    .trim();
}

function extractStateCode(value = "") {
  const normalized = normalizeLocationText(value);
  const ufMatch = normalized.match(/\b(ac|al|ap|am|ba|ce|df|es|go|ma|mg|ms|mt|pa|pb|pe|pi|pr|rj|rn|ro|rr|rs|sc|se|sp|to)\b/);

  if (ufMatch) {
    return ufMatch[1].toUpperCase();
  }

  for (const [stateName, uf] of Object.entries(STATE_NAME_TO_UF)) {
    if (normalized.includes(stateName)) {
      return uf;
    }
  }

  return "";
}

function extractCityCandidate(value = "") {
  const parts = String(value || "")
    .split(/[,/|•-]+/)
    .map((part) => stripLocationNoise(part))
    .filter(Boolean);

  if (parts.length === 0) {
    return "";
  }

  return parts[0] || "";
}

function getMetroGroup(city = "") {
  return CITY_TO_METRO.get(normalizeLocationText(city)) || null;
}

function parseLocationDescriptor(value = "") {
  const normalized = normalizeLocationText(value);
  const uf = extractStateCode(value);
  const city = extractCityCandidate(value);
  const metroGroup = getMetroGroup(city);
  const region = uf ? STATE_INFO[uf]?.region || "" : "";

  return {
    raw: String(value || "").trim(),
    normalized,
    city,
    uf,
    region,
    metroGroupId: metroGroup?.id || "",
    metroGroupLabel: metroGroup?.label || "",
    isRemote: unique([...REMOTE_TERMS]).some((term) => hasTerm(normalized, term)),
    isHybrid: unique([...HYBRID_TERMS]).some((term) => hasTerm(normalized, term)),
    isOnsite: unique([...ONSITE_TERMS]).some((term) => hasTerm(normalized, term)),
    hasLocation: Boolean(normalized)
  };
}

function inferMobilityPreferences(profileText = "") {
  const normalized = normalizeLocationText(profileText);

  return {
    remotePreferred: unique([...REMOTE_TERMS]).some((term) => hasTerm(normalized, term)),
    hybridFriendly: unique([...HYBRID_TERMS]).some((term) => hasTerm(normalized, term)),
    onsiteFriendly: unique([...ONSITE_TERMS]).some((term) => hasTerm(normalized, term)),
    relocationFriendly: unique([...RELOCATION_TERMS]).some((term) => hasTerm(normalized, term))
  };
}

function clampScore(value, min = 0, max = 20) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function resolveJobMode({ jobRemote = false, jobType = "", jobLocation = "" } = {}) {
  const normalized = normalizeLocationText(`${jobType} ${jobLocation}`);

  if (jobRemote || unique([...REMOTE_TERMS]).some((term) => hasTerm(normalized, term))) {
    return "remote";
  }

  if (unique([...HYBRID_TERMS]).some((term) => hasTerm(normalized, term))) {
    return "hybrid";
  }

  if (unique([...ONSITE_TERMS]).some((term) => hasTerm(normalized, term))) {
    return "onsite";
  }

  return "unknown";
}

function buildLocationReasons({ bucket, jobMode, mobility, profile, job }) {
  const reasons = [];

  switch (bucket) {
    case "same_city":
      reasons.push("Mesma cidade");
      break;
    case "metro":
      reasons.push("Mesma regiao metropolitana");
      break;
    case "same_state":
      reasons.push("Mesmo estado");
      break;
    case "same_region":
      reasons.push("Mesma regiao");
      break;
    case "remote":
      reasons.push("Vaga remota");
      break;
    default:
      if (profile.hasLocation && job.hasLocation) {
        reasons.push("Localidade diferente");
      }
  }

  if (jobMode === "remote") {
    if (mobility.remotePreferred) {
      reasons.push("Perfil favorece remoto");
    }
    if (mobility.relocationFriendly) {
      reasons.push("Perfil aceita deslocamento");
    }
  }

  if (jobMode === "hybrid" && mobility.relocationFriendly) {
    reasons.push("Perfil aceita hibrido");
  }

  if (jobMode === "onsite" && mobility.relocationFriendly) {
    reasons.push("Perfil aceita deslocamento");
  }

  if (!profile.hasLocation && job.hasLocation) {
    reasons.push("Perfil sem localizacao");
  }

  return unique(reasons);
}

function scoreLocationByBucket(bucket, jobMode, mobility) {
  const baseByBucket = {
    same_city: 12,
    metro: 10,
    same_state: 8,
    same_region: 5,
    remote: 8,
    other: 2
  };

  const modeBonusByBucket = {
    remote: {
      same_city: 6,
      metro: 7,
      same_state: 8,
      same_region: 8,
      remote: 10,
      other: 6
    },
    hybrid: {
      same_city: 7,
      metro: 7,
      same_state: 6,
      same_region: 4,
      remote: 4,
      other: mobility.relocationFriendly ? 4 : 2
    },
    onsite: {
      same_city: 8,
      metro: 6,
      same_state: 4,
      same_region: 2,
      remote: 2,
      other: mobility.relocationFriendly ? 4 : mobility.onsiteFriendly ? 3 : 1
    },
    unknown: {
      same_city: 5,
      metro: 4,
      same_state: 3,
      same_region: 2,
      remote: 5,
      other: 2
    }
  };

  const bucketScore = baseByBucket[bucket] || baseByBucket.other;
  const modeScore = (modeBonusByBucket[jobMode] || modeBonusByBucket.unknown)[bucket] || 0;
  const mobilityBonus = mobility.remotePreferred && jobMode === "remote"
    ? 2
    : mobility.relocationFriendly && bucket !== "same_city" && jobMode !== "remote"
      ? 1
      : 0;

  return clampScore(bucketScore + modeScore + mobilityBonus);
}

function compareLocation(profileLocation = "", jobLocation = "", { jobRemote = false, jobType = "", profileText = "" } = {}) {
  const profile = parseLocationDescriptor(profileLocation);
  const job = parseLocationDescriptor(jobLocation);
  const mobility = inferMobilityPreferences(profileText);
  const jobMode = resolveJobMode({ jobRemote, jobType, jobLocation });

  let bucket = "other";

  if (profile.city && job.city && profile.city === job.city && profile.uf && job.uf && profile.uf === job.uf) {
    bucket = "same_city";
  } else if (profile.metroGroupId && job.metroGroupId && profile.metroGroupId === job.metroGroupId) {
    bucket = "metro";
  } else if (profile.uf && job.uf && profile.uf === job.uf) {
    bucket = "same_state";
  } else if (profile.region && job.region && profile.region === job.region) {
    bucket = "same_region";
  } else if (jobMode === "remote") {
    bucket = "remote";
  }

  const score = scoreLocationByBucket(bucket, jobMode, mobility);
  const reasons = buildLocationReasons({
    bucket,
    jobMode,
    mobility,
    profile,
    job
  });

  return {
    score,
    bucket,
    jobMode,
    reasons,
    profile,
    job,
    label:
      bucket === "same_city"
        ? "Mesma cidade"
        : bucket === "metro"
          ? "Regiao metropolitana"
          : bucket === "same_state"
            ? "Mesmo estado"
            : bucket === "same_region"
              ? "Mesma regiao"
              : jobMode === "remote"
                ? "Vaga remota"
                : "Outra localidade"
  };
}

function getLocationRelevance(options = {}) {
  return compareLocation(
    options.profileLocation || "",
    options.jobLocation || "",
    options
  );
}

export {
  getLocationRelevance,
  inferMobilityPreferences,
  normalizeLocationText,
  parseLocationDescriptor,
  resolveJobMode
};
