import { appendSkill } from "./skillSuggestions.js";

const levels = {
  estudante: "Estudante", estagio: "Estagio", estagiario: "Estagio", junior: "Junior",
  pleno: "Pleno", senior: "Senior", especialista: "Especialista", lideranca: "Lideranca",
};

export function profileImportCandidates(analysis = {}, profile = {}) {
  const level = String(analysis.seniority || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const currentSkills = profile.skills || [];
  const skills = (Array.isArray(analysis.detected_skills) ? analysis.detected_skills : [])
    .filter((skill) => typeof skill === "string" && skill.trim().length <= 60)
    .reduce((list, skill) => appendSkill(list, skill), currentSkills);
  return [
    { field: "phone", label: "Telefone", value: String(analysis.parsed_data?.phone || "").trim() },
    { field: "experienceLevel", label: "Nível de experiência", value: levels[level] || "" },
    { field: "skills", label: "Habilidades", value: skills, additive: true },
  ].filter(({ field, value }) => (Array.isArray(value) ? value.length > currentSkills.length : Boolean(value))
    && JSON.stringify(value) !== JSON.stringify(profile[field]));
}
