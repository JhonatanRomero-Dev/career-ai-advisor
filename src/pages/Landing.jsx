import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import PaymentModal from "@/components/payment/PaymentModal";
import {
  Sparkles,
  FileSearch,
  Briefcase,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Star,
  BarChart3,
  ListChecks,
  LockKeyhole,
  ShieldCheck,
  LogOut,
  UserCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { base44 } from "@/api/base44Client";
import { readAuthSession } from "@/lib/authSession";

const features = [
  {
    icon: FileSearch,
    title: "Análise para filtros de recrutamento (ATS)",
    desc: "Veja se sistemas de triagem conseguem ler seu currículo e quais ajustes facilitam a análise humana."
  },
  {
    icon: Briefcase,
    title: "Vagas compatíveis",
    desc: "Descubra vagas que realmente combinam com suas habilidades e experiência."
  },
  {
    icon: TrendingUp,
    title: "Insights práticos",
    desc: "Receba sugestões específicas para aumentar suas chances."
  },
];

const benefits = [
  "Leitura por filtros de recrutamento (ATS)",
  "Detecção de palavras fracas",
  "Análise de palavras-chave ausentes",
  "Avaliação de clareza profissional",
  "Nota de compatibilidade com o mercado",
  "Sugestões de melhoria com IA",
];

const plans = [
  {
    name: "Gratuito",
    price: "R$ 0",
    period: "/mês",
    description: "Para testar a análise e entender seu ponto de partida.",
    features: [
      "3 análises de currículo por mês",
      "Nota ATS básica",
      "Sugestões essenciais",
      "Histórico limitado",
    ],
    cta: "Começar grátis",
    path: "/upload",
    featured: false,
  },
  {
    name: "Pro",
    price: "R$ 29",
    period: "/mês",
    description: "Para evoluir o currículo com acompanhamento mais completo.",
    features: [
      "Análises ilimitadas",
      "Relatório completo com IA",
      "Vagas compatíveis",
      "Suporte IA prioritário",
    ],
    cta: "Assinar Pro",
    path: "/dashboard",
    featured: true,
  },
  {
    name: "Premium",
    price: "R$ 59",
    period: "/mês",
    description: "Para quem quer acelerar candidatura e preparação.",
    features: [
      "Tudo do plano Pro",
      "Otimização por vaga",
      "Simulação de entrevista",
      "Prioridade em novos recursos",
    ],
    cta: "Ver Premium",
    path: "/dashboard",
    featured: false,
  },
];

const faqItems = [
  {
    question: "Como funciona a análise de currículo?",
    answer:
      "Você envia seu currículo, a IA avalia clareza, palavras-chave, pontos fracos e compatibilidade ATS, depois entrega uma nota com sugestões práticas de melhoria.",
  },
  {
    question: "O que é a nota ATS?",
    answer:
      "A nota ATS indica o quanto seu currículo está preparado para sistemas de triagem usados por empresas. Ela considera estrutura, termos relevantes, objetividade e legibilidade.",
  },
  {
    question: "Meus dados ficam salvos?",
    answer:
      "O histórico de análises pode ficar disponível na sua conta para acompanhar sua evolução. Você também pode usar o suporte para tirar dúvidas sobre privacidade e dados.",
  },
  {
    question: "Posso usar a plataforma de graça?",
    answer:
      "Sim. O plano gratuito permite fazer 3 análises de currículo por mês. Os planos pagos liberam mais análises, relatórios completos e recursos avançados.",
  },
  {
    question: "A IA também encontra vagas?",
    answer:
      "Sim. A plataforma usa as informações do seu perfil e da análise para sugerir vagas mais compatíveis com suas habilidades e experiência.",
  },
  {
    question: "Preciso refazer a análise depois de editar o currículo?",
    answer:
      "Sim, vale reenviar o currículo atualizado. Assim você compara a nova nota, valida as melhorias e identifica os próximos ajustes.",
  },
];

const reportPreview = [
  { label: "Nota ATS", value: "86", icon: BarChart3, tone: "text-primary" },
  { label: "Clareza", value: "91", icon: Sparkles, tone: "text-emerald-600" },
  { label: "Match médio", value: "78%", icon: Briefcase, tone: "text-orange-600" },
];

export default function Landing() {
  const navigate = useNavigate();
  const [session, setSession] = useState(() => readAuthSession());
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const isLogged = session.isAuthenticated;
  const accountLabel = session.user?.name || session.user?.email || "Minha conta";

  useEffect(() => {
    const refreshSession = () => setSession(readAuthSession());

    window.addEventListener("focus", refreshSession);
    window.addEventListener("storage", refreshSession);

    return () => {
      window.removeEventListener("focus", refreshSession);
      window.removeEventListener("storage", refreshSession);
    };
  }, []);

  const handleEnter = (path) => {
    const currentSession = readAuthSession();

    setSession(currentSession);

    if (currentSession.isAuthenticated) {
      navigate(path);
      return;
    }

    navigate(`/login?next=${encodeURIComponent(path)}`);
  };

  const handlePlanClick = (plan) => {
    if (plan.name === "Gratuito") {
      handleEnter(plan.path);
      return;
    }

    if (!readAuthSession().isAuthenticated) {
      navigate(`/login?next=${encodeURIComponent(plan.path)}`);
      return;
    }

    setSelectedPlan(plan);
    setShowPayment(true);
  };

  return (
    <div className="animated-page-bg min-h-screen overflow-hidden">
      <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-xl border-b border-border/50 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <button
            type="button"
            className="flex items-center gap-2.5 rounded-lg text-left outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => navigate(isLogged ? "/dashboard" : "/")}
          >
            <div className="soft-pulse w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">Career AI</span>
          </button>

          <div className="flex items-center gap-3">
            <ThemeToggle collapsed className="h-9 w-9" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" })}
            >
              FAQ
            </Button>
            {isLogged ? (
              <>
                <Button type="button" variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
                  Painel
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" size="sm" className="gap-2">
                      <UserCircle className="h-4 w-4" />
                      Minha conta
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="truncate">{accountLabel}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => navigate("/profile")}>
                      <UserCircle className="h-4 w-4" />
                      Perfil
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => base44.auth.logout()}>
                      <LogOut className="h-4 w-4" />
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button type="button" variant="ghost" size="sm" onClick={() => navigate("/login")}>
                  Entrar
                </Button>
                <Button type="button" size="sm" onClick={() => handleEnter("/upload")}>
                  Começar
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      <section className="relative pt-32 pb-20 px-6">
        <div className="animated-grid-bg pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <motion.div
              whileHover={{ scale: 1.04, rotate: -1 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-semibold mb-6"
            >
              <Star className="icon-float w-3.5 h-3.5" />
              Plataforma de carreira com IA
            </motion.div>

            <h1 className="text-4xl md:text-6xl font-extrabold text-foreground leading-tight tracking-tight">
              Transforme seu currículo em{" "}
              <span className="text-primary">oportunidades de entrevista.</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground mt-6 max-w-2xl mx-auto leading-relaxed">
              Envie seu currículo e deixe nossa IA analisar tudo em segundos.
              Receba uma nota ATS, descubra palavras-chave ausentes e encontre vagas ideais.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
              <Button
                type="button"
                size="lg"
                className="h-13 px-8 text-base font-semibold shadow-lg shadow-primary/25 hover:translate-y-0 hover:scale-100 active:scale-100"
                onClick={() => handleEnter("/upload")}
              >
                Analisar meu currículo
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                type="button"
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
              Três passos simples para chegar mais perto da vaga ideal
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
                className="interactive-card bg-card rounded-2xl p-8 border border-border/50 hover:border-primary/20"
              >
                <div className="icon-float w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
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
              Tudo o que você precisa para se destacar
            </h2>
            <p className="text-muted-foreground mb-8">
              Nossa IA revisa cada detalhe do seu currículo e entrega uma análise completa.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {benefits.map((b, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ x: 4 }}
                  className="flex items-center gap-2.5"
                >
                  <CheckCircle2 className="w-4.5 h-4.5 text-primary flex-shrink-0" />
                  <span className="text-sm text-foreground">{b}</span>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="flex-1 flex justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, rotate: -3 }}
              whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
              viewport={{ once: true }}
              transition={{ type: "spring", stiffness: 120, damping: 14 }}
              className="w-72 h-72 bg-gradient-to-br from-primary/20 via-card to-emerald-500/10 rounded-3xl flex items-center justify-center border border-border/50 shadow-xl shadow-primary/10"
            >
              <div className="text-center">
                <div className="soft-pulse text-6xl font-extrabold text-primary">92</div>
                <div className="text-sm text-muted-foreground mt-2 font-medium">
                  Melhoria média na nota ATS
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <FileSearch className="h-3.5 w-3.5" />
              Prévia do relatório
            </div>
            <h2 className="text-3xl font-bold text-foreground">
              Veja exatamente o que precisa mudar no currículo
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              O relatório transforma a análise em decisões claras: quais termos faltam,
              quais frases estão fracas, onde sua clareza cai e quais vagas combinam melhor.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                "Prioridades de correção",
                "Palavras-chave por vaga",
                "Sugestões prontas para aplicar",
                "Evolução após cada envio",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-primary" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl border border-border/50 bg-card p-5 shadow-xl shadow-primary/10"
          >
            <div className="mb-5 flex items-center justify-between border-b border-border/50 pb-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Relatório de análise</p>
                <p className="text-xs text-muted-foreground">currículo-final.pdf</p>
              </div>
              <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600">
                Pronto
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {reportPreview.map((item) => (
                <div key={item.label} className="rounded-xl border border-border/50 bg-background p-4">
                  <item.icon className={`mb-3 h-5 w-5 ${item.tone}`} />
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-3">
              {[
                ["Adicionar palavras-chave", "React, CRM, indicadores e automação aparecem nas vagas ideais."],
                ["Trocar frases genéricas", "Substitua responsabilidades vagas por impacto mensurável."],
                ["Candidatar com foco", "Até 8 vagas podem aparecer com match alto para seu perfil atual."],
              ].map(([title, text]) => (
                <div key={title} className="flex gap-3 rounded-xl bg-muted/40 p-4">
                  <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <ListChecks className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12 text-center"
          >
            <h2 className="text-3xl font-bold text-foreground">Planos e valores</h2>
            <p className="mt-3 text-muted-foreground">
              Escolha o plano ideal para melhorar seu currículo e acompanhar sua evolução.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className={`interactive-card relative rounded-2xl border p-6 ${
                  plan.featured
                    ? "border-primary bg-primary text-primary-foreground shadow-xl shadow-primary/20"
                    : "border-border/50 bg-card text-card-foreground"
                }`}
              >
                {plan.featured && (
                  <div className="absolute right-4 top-4 rounded-full bg-primary-foreground px-3 py-1 text-xs font-semibold text-primary">
                    Mais escolhido
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <p className={`mt-2 text-sm ${plan.featured ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {plan.description}
                  </p>
                </div>

                <div className="mb-6 flex items-end gap-1">
                  <span className="text-4xl font-extrabold">{plan.price}</span>
                  <span className={`pb-1 text-sm ${plan.featured ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                    {plan.period}
                  </span>
                </div>

                <div className="mb-6 space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2.5 text-sm">
                      <CheckCircle2
                        className={`h-4 w-4 flex-shrink-0 ${
                          plan.featured ? "text-primary-foreground" : "text-primary"
                        }`}
                      />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant={plan.featured ? "secondary" : "outline"}
                  className="w-full"
                  onClick={() => handlePlanClick(plan)}
                >
                  {plan.cta}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-6 bg-muted/30">
        <div className="max-w-5xl mx-auto grid gap-6 md:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: "Privacidade em primeiro lugar",
              text: "Seu currículo é usado para gerar a análise e melhorar suas recomendações dentro da sua conta.",
            },
            {
              icon: LockKeyhole,
              title: "Controle do histórico",
              text: "Você acompanha suas análises salvas e pode falar com o suporte sobre dados, conta ou privacidade.",
            },
            {
              icon: FileSearch,
              title: "IA com contexto",
              text: "As respostas do suporte podem considerar sua análise mais recente para serem mais úteis e específicas.",
            },
          ].map((item) => (
            <div key={item.title} className="flex gap-4">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-10 text-center"
          >
            <h2 className="text-3xl font-bold text-foreground">Perguntas frequentes</h2>
            <p className="mt-3 text-muted-foreground">
              Respostas rápidas sobre análise, planos, vagas e uso da plataforma.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="rounded-2xl border border-border/50 bg-card px-5 shadow-sm"
          >
            <Accordion type="single" collapsible className="w-full">
              {faqItems.map((item) => (
                <AccordionItem key={item.question} value={item.question}>
                  <AccordionTrigger className="text-base font-semibold text-foreground hover:text-primary hover:no-underline">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
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

      <PaymentModal
        open={showPayment}
        onOpenChange={setShowPayment}
        plan={selectedPlan}
      />
    </div>
  );
}
