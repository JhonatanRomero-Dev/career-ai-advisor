import { z } from "zod";
import { isProfilePhoto } from "./profilePhoto.js";

const text = (max = 200) => z.string().trim().max(max);
const link = z.union([z.literal(""), z.string().trim().max(2048).url().refine((value) => /^https?:\/\//i.test(value), "Use um link http ou https.")]);
const entry = (titleMessage) => z.object({
  id: text(100), title: text().min(1, titleMessage), organization: text().default(""),
  start: text(30).default(""), end: text(30).default(""),
  description: text(2000).default(""), url: link.default("")
});
export const professionalSchema = z.object({
  photo: z.string().max(400_000, "A foto é grande demais. Selecione a imagem novamente.").refine(isProfilePhoto, "Foto inválida. Selecione uma imagem JPG, PNG ou WebP pelo perfil.").default(""),
  github: link.default(""), skills: z.array(text(60).min(1, "Remova a habilidade vazia ou informe seu nome.")).max(50).default([]),
  experiences: z.array(entry("Preencha o cargo da experiência ou remova o item que não deseja cadastrar.")).max(30).default([]),
  projects: z.array(entry("Preencha o nome do projeto ou remova o item que não deseja cadastrar.")).max(30).default([]),
  certificates: z.array(entry("Preencha o nome do certificado ou remova o item que não deseja cadastrar.")).max(30).default([]),
  achievements: z.array(entry("Preencha o título da conquista ou remova o item que não deseja cadastrar.")).max(30).default([]),
  publicEnabled: z.boolean().default(false)
});
export const filtersSchema = z.object({
  search: text().default(""), location: text().default(""),
  source: text().default("all"), mode: z.enum(["all", "remote", "hybrid", "onsite"]).default("all"),
  age: z.enum(["all", "1", "7", "30", "60"]).default("all"),
  match: z.enum(["all", "high", "good", "improve"]).default("all"),
  area: text().default("all"), level: text().default("all"), company: text().default("all"),
  contract: text().default("all"), salaryMin: z.coerce.number().min(0).max(1000000).default(0),
  salaryMax: z.coerce.number().min(0).max(1000000).default(0),
  sortBy: z.enum(["match-desc", "match-asc", "recent", "title", "company", "salary-desc"]).default("match-desc")
}).refine((value) => !value.salaryMax || value.salaryMax >= value.salaryMin, "A faixa salarial está invertida.");
export const savedSearchSchema = z.object({ name: text(80).min(1, "Informe um nome para salvar a pesquisa."), filters: filtersSchema });
export const feedbackSchema = z.object({
  category: z.enum(["suggestion", "bug", "experience", "support", "usability"]),
  rating: z.number().int().min(1).max(5), message: text(4000).min(10),
  page: text(100).default(""), volunteer: z.boolean().default(false),
  audience: z.enum(["", "first-job", "transition", "experienced", "recruiter"]).default(""),
  tasks: z.array(z.object({ id: z.enum(["search", "profile", "login", "support", "analyze", "revise", "export", "apply"]), result: z.enum(["done", "difficult", "blocked", "untested"]) })).max(8).default([])
});
