import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  FileSearch,
  Briefcase,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Star
} from "lucide-react";
import { motion } from "framer-motion";
import ThemeToggle from "@/components/theme/ThemeToggle";

const features = [
  {
    icon: FileSearch,
    title: "Analise de curriculo com IA",
    desc: "Receba uma nota ATS detalhada e encontre pontos fracos na hora."
  },
  {
    icon: Briefcase,
    title: "Vagas compativeis",
    desc: "Descubra vagas que realmente combinam com suas habilidades e experiencia."
  },
  {
    icon: TrendingUp,
    title: "Insights praticos",
    desc: "Receba sugestoes especificas para aumentar suas chances."
  },
];

const benefits = [
  "Nota ATS de 0 a 100",
  "Deteccao de palavras fracas",
  "Analise de palavras-chave ausentes",
  "Avaliacao de clareza profissional",
  "Nota de compatibilidade com o mercado",
  "Sugestoes de melhoria com IA",
];

export default function Landing() {
  const navigate = useNavigate();

  const handleEnter = (path) => {
    if (localStorage.getItem("logged") === "true") {
      navigate(path);
      return;
    }

    navigate(`/login?next=${encodeURIComponent(path)}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-xl border-b border-border/50 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">Career AI</span>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle collapsed className="h-9 w-9" />
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
              Entrar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleEnter("/dashboard")}>
              Painel
            </Button>
            <Button size="sm" onClick={() => handleEnter("/upload")}>
              Comecar
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-semibold mb-6">
              <Star className="w-3.5 h-3.5" />
              Plataforma de carreira com IA
            </div>

            <h1 className="text-4xl md:text-6xl font-extrabold text-foreground leading-tight tracking-tight">
              Transforme seu curriculo em{" "}
              <span className="text-primary">oportunidades de entrevista.</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground mt-6 max-w-2xl mx-auto leading-relaxed">
              Envie seu curriculo e deixe nossa IA analisar tudo em segundos.
              Receba uma nota ATS, descubra palavras-chave ausentes e encontre vagas ideais.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
              <Button
                size="lg"
                className="h-13 px-8 text-base font-semibold shadow-lg shadow-primary/25"
                onClick={() => handleEnter("/upload")}
              >
                Analisar meu curriculo
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-13 px-8 text-base"
                onClick={() => handleEnter("/dashboard")}
              >
                Ver painel
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-foreground">Como funciona</h2>
            <p className="text-muted-foreground mt-3">
              Tres passos simples para chegar mais perto da vaga ideal
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="bg-card rounded-2xl p-8 border border-border/50 hover:shadow-lg hover:border-primary/20 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                  <f.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-12 items-center">
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Tudo o que voce precisa para se destacar
            </h2>
            <p className="text-muted-foreground mb-8">
              Nossa IA revisa cada detalhe do seu curriculo e entrega uma analise completa.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {benefits.map((b, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4.5 h-4.5 text-primary flex-shrink-0" />
                  <span className="text-sm text-foreground">{b}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 flex justify-center">
            <div className="w-72 h-72 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent rounded-3xl flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl font-extrabold text-primary">92</div>
                <div className="text-sm text-muted-foreground mt-2 font-medium">
                  Melhoria media na nota ATS
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-10 px-6 border-t border-border/50">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Career AI Advisor</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © 2026 Career AI Advisor. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
