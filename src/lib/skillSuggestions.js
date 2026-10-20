const groups = {
  "Linguagens": ["Python", "JavaScript", "TypeScript", "Java", "C", "C++", "C#", "Go", "Rust", "PHP", "Ruby", "Swift", "Kotlin", "Dart", "R", "SQL", "Bash", "PowerShell", "Scala", "MATLAB"],
  "Frontend": ["React", "React Native", "Angular", "Vue.js", "Next.js", "HTML", "CSS", "Tailwind CSS", "Bootstrap", "Sass", "Redux", "Svelte", "Acessibilidade web"],
  "Backend": ["Node.js", "Express", "Django", "Flask", "FastAPI", "Spring Boot", "Laravel", ".NET", "NestJS", "Ruby on Rails", "APIs REST", "GraphQL", "Microsserviços"],
  "Dados e IA": ["Pandas", "NumPy", "PyTorch", "PySpark", "TensorFlow", "Scikit-learn", "Apache Spark", "Machine Learning", "Deep Learning", "Análise de dados", "Engenharia de dados", "Estatística", "Power BI", "Tableau", "Excel", "ETL"],
  "Banco de dados": ["PostgreSQL", "MySQL", "SQLite", "SQL Server", "MongoDB", "Redis", "Oracle", "Elasticsearch"],
  "Nuvem e ferramentas": ["AWS", "Microsoft Azure", "Google Cloud", "Docker", "Kubernetes", "Terraform", "Git", "GitHub", "GitLab", "Jenkins", "Linux", "CI/CD", "DevOps", "Segurança da informação"],
  "Testes": ["Playwright", "Cypress", "Jest", "Vitest", "Pytest", "JUnit", "Postman", "Testes automatizados", "Testes de software", "Garantia da qualidade"],
  "Design e produto": ["Figma", "Adobe Photoshop", "Adobe Illustrator", "UX Design", "UI Design", "Pesquisa com usuários", "Prototipação", "Design de produto", "Gestão de produto", "Scrum", "Kanban", "Jira"],
  "Negócios": ["Gestão de projetos", "Gestão de pessoas", "Atendimento ao cliente", "Vendas", "Negociação", "Marketing digital", "SEO", "Copywriting", "Redes sociais", "Google Analytics", "CRM", "Salesforce", "HubSpot", "Contabilidade", "Análise financeira", "Planejamento estratégico", "Logística", "Recrutamento e seleção", "Recursos humanos", "Pacote Office"],
  "Competências pessoais": ["Comunicação", "Liderança", "Trabalho em equipe", "Resolução de problemas", "Pensamento analítico", "Organização", "Gestão do tempo", "Adaptabilidade", "Criatividade", "Inteligência emocional", "Inglês", "Espanhol", "Português"],
};

const aliases = {
  "JavaScript": ["js"], "TypeScript": ["ts"], "Python": ["python3", "python 3"],
  "React": ["reactjs", "react.js"], "Node.js": ["nodejs", "node"], "Vue.js": ["vuejs", "vue"],
  "Next.js": ["nextjs", "next"], "PostgreSQL": ["postgres"], "Power BI": ["powerbi"],
  "AWS": ["amazon web services"], "Google Cloud": ["gcp", "google cloud platform"],
  "Microsoft Azure": ["azure"], ".NET": ["dotnet", "asp.net"], "Scikit-learn": ["sklearn"],
  "Excel": ["microsoft excel"], "Pacote Office": ["microsoft office"], "Go": ["golang"],
};

export const SKILL_CATALOG = Object.entries(groups).flatMap(([category, labels]) =>
  labels.map((label) => ({ label, category, aliases: aliases[label] || [] }))
);

export function normalizeSkill(value) {
  return String(value || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ");
}

export function canonicalSkill(value) {
  const normalized = normalizeSkill(value);
  return SKILL_CATALOG.find((skill) => [skill.label, ...skill.aliases].some((term) => normalizeSkill(term) === normalized))?.label || String(value || "").trim();
}

export function skillSuggestions(query, selected = [], limit = 8) {
  const normalized = normalizeSkill(query);
  if (normalized.length < 3) return [];
  const added = new Set(selected.map((value) => normalizeSkill(canonicalSkill(value))));
  return SKILL_CATALOG.filter((skill) => !added.has(normalizeSkill(skill.label)))
    .map((skill) => {
      const scores = [skill.label, ...skill.aliases].map((term) => {
        const candidate = normalizeSkill(term);
        return candidate === normalized ? 0 : candidate.startsWith(normalized) ? 1 : candidate.includes(normalized) ? 2 : 3;
      });
      return { ...skill, score: Math.min(...scores) };
    })
    .filter((skill) => skill.score < 3)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);
}

export function appendSkill(selected, value, limit = 50) {
  const label = canonicalSkill(value);
  if (!label || label.length > 60 || selected.length >= limit || selected.some((item) => normalizeSkill(canonicalSkill(item)) === normalizeSkill(label))) return selected;
  return [...selected, label];
}
