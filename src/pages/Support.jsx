import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Bot,
  Check,
  CircleHelp,
  Clipboard,
  FileText,
  LifeBuoy,
  MailWarning,
  MessageSquareText,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const MAX_MESSAGE_CHARS = 1200;
const CHAT_STORAGE_PREFIX = "career-ai-support-chat";

const initialMessages = [
  {
    role: "assistant",
    content:
      "Olá! Sou o suporte IA do Career AI. Posso ajudar com código de verificação, uso do painel, vagas ou explicar sua análise de currículo.",
  },
];

const quickPrompts = [
  "Não recebi o código no e-mail",
  "Explique minha nota ATS",
  "Como melhoro meu currículo?",
  "Como encontro vagas compatíveis?",
];

const faqItems = [
  {
    icon: MailWarning,
    category: "Conta",
    title: "Código de verificação",
    text: "O código de verificação é enviado por e-mail expira em 10 minutos. Confira também a pasta de spam.",
  },
  {
    icon: Sparkles,
    category: "Análise",
    title: "Análise de currículo",
    text: "O assistente usa sua análise mais recente para explicar notas, palavras-chave e sugestões.",
  },
  {
    icon: LifeBuoy,
    title: "Suporte humano",
    category: "Privacidade",
    text: "Casos de conta, privacidade, exclusão de dados ou erro persistente devem ir para atendimento humano.",
  },
  {
    icon: CircleHelp,
    category: "Vagas",
    title: "Recomendações de vagas",
    text: "As vagas aparecem depois de uma análise concluída e usam compatibilidade, palavras-chave e experiência.",
  },
  {
    icon: Sparkles,
    category: "Planos",
    title: "Planos Pro e Premium",
    text: "Os planos pagos liberam mais análises, recursos avançados e acompanhamento mais completo da evolução.",
  },
];

export default function Support() {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [latestAnalysis, setLatestAnalysis] = useState(null);
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [faqSearch, setFaqSearch] = useState("");
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [hasLoadedSavedChat, setHasLoadedSavedChat] = useState(false);
  const messagesEndRef = useRef(null);
  const chatStorageKey = currentUser?.email
    ? `${CHAT_STORAGE_PREFIX}:${currentUser.email.trim().toLowerCase()}`
    : "";

  const conversationHistory = useMemo(
    () =>
      messages
        .filter((message) => message.role === "user" || message.role === "assistant")
        .map(({ role, content }) => ({ role, content })),
    [messages]
  );

  const contextualQuickPrompts = useMemo(() => {
    const prompts = [...quickPrompts];

    if (latestAnalysis) {
      prompts.splice(1, 0, "Quais são minhas 3 prioridades agora?");
      prompts.push("Monte um plano de 7 dias para melhorar meu currículo");
    }

    if (!profile?.summary || !profile?.targetRole) {
      prompts.push("O que devo preencher no meu perfil?");
    }

    return Array.from(new Set(prompts)).slice(0, 7);
  }, [latestAnalysis, profile]);

  const filteredFaqItems = useMemo(() => {
    const normalizedSearch = faqSearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return faqItems;
    }

    return faqItems.filter((item) =>
      [item.category, item.title, item.text]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [faqSearch]);

  useEffect(() => {
    async function loadContext() {
      try {
        const [userData, profileData, analyses] = await Promise.all([
          base44.auth.getUser(),
          base44.auth.getProfile().catch(() => null),
          base44.entities.ResumeAnalysis.list("-created_date", 1),
        ]);

        setCurrentUser(userData);
        setProfile(profileData);

        if (analyses.length > 0) {
          setLatestAnalysis(analyses[0]);
          return;
        }

        const saved = localStorage.getItem("analysisResult");

        if (saved) {
          setLatestAnalysis(JSON.parse(saved).analysis);
        }
      } catch (contextError) {
        console.error("Erro ao carregar contexto do suporte:", contextError);
      } finally {
        setIsLoadingContext(false);
      }
    }

    loadContext();
  }, []);

  useEffect(() => {
    if (!chatStorageKey) {
      return;
    }

    setHasLoadedSavedChat(false);

    try {
      const saved = JSON.parse(localStorage.getItem(chatStorageKey) || "[]");

      if (Array.isArray(saved) && saved.length > 0) {
        setMessages(saved);
      }
    } catch {
      setMessages(initialMessages);
    } finally {
      setHasLoadedSavedChat(true);
    }
  }, [chatStorageKey]);

  useEffect(() => {
    if (!chatStorageKey || !hasLoadedSavedChat) {
      return;
    }

    localStorage.setItem(chatStorageKey, JSON.stringify(messages.slice(-40)));
  }, [chatStorageKey, hasLoadedSavedChat, messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const sendMessage = async (content = input) => {
    const trimmed = content.trim().slice(0, MAX_MESSAGE_CHARS);

    if (!trimmed || isSending) {
      return;
    }

    const userMessage = {
      role: "user",
      content: trimmed,
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError("");
    setIsSending(true);

    try {
      const response = await base44.support.chat({
        message: trimmed,
        history: conversationHistory,
      });

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: response.reply,
          fallback: Boolean(response.fallback),
          model: response.model,
          provider: response.provider,
        },
      ]);
    } catch (chatError) {
      console.error("Erro no suporte IA:", chatError);
      setError(chatError.message || "Não foi possível responder agora.");
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            "Não consegui acessar o suporte IA agora. Confira a configuração da chave de IA no backend ou tente novamente em alguns instantes.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage();
  };

  const clearChat = () => {
    setMessages(initialMessages);
    setError("");

    if (chatStorageKey) {
      localStorage.removeItem(chatStorageKey);
    }
  };

  const copyMessage = async (content, index) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex(null), 1600);
    } catch {
      setError("Não foi possível copiar a resposta agora.");
    }
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <LifeBuoy className="h-3.5 w-3.5" />
            Suporte
          </div>
          <h1 className="text-2xl font-bold text-foreground">Chat com IA</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tire dúvidas sobre acesso, análises e próximos passos do seu currículo.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={clearChat}>
            <Trash2 className="mr-2 h-4 w-4" />
            Limpar chat
          </Button>
          <Link to="/history">
            <Button variant="outline" size="sm">
              <MessageSquareText className="mr-2 h-4 w-4" />
              Ver análises
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="flex min-h-[640px] flex-col border-border/50">
          <div className="border-b border-border/50 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Assistente Career AI</p>
                  <p className="text-xs text-muted-foreground">
                    {isLoadingContext
                      ? "Carregando contexto..."
                      : latestAnalysis
                        ? `Usando ${latestAnalysis.file_name || "sua análise mais recente"}`
                        : "Sem análise vinculada"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {messages.map((message, index) => {
              const isUser = message.role === "user";

              return (
                <motion.div
                  key={`${message.role}-${index}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {!isUser && (
                    <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}

                  <div className={`max-w-[82%] ${isUser ? "items-end" : "items-start"}`}>
                    <div
                      className={`whitespace-pre-wrap rounded-lg px-4 py-3 text-sm leading-relaxed ${
                        isUser
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-muted/40 text-foreground"
                      }`}
                    >
                      {message.content}
                    </div>
                    {!isUser && (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {message.fallback && (
                          <Badge variant="secondary" className="gap-1 text-[10px]">
                            <ShieldCheck className="h-3 w-3" />
                            resposta local
                          </Badge>
                        )}
                        {message.model && (
                          <span className="text-[10px] text-muted-foreground">
                            {message.provider}/{message.model}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => copyMessage(message.content, index)}
                          className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-primary"
                        >
                          {copiedIndex === index ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Clipboard className="h-3 w-3" />
                          )}
                          {copiedIndex === index ? "Copiado" : "Copiar"}
                        </button>
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </motion.div>
              );
            })}

            {isSending && (
              <div className="flex gap-3">
                <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                  Pensando...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-border/50 p-5">
            <div className="mb-3 flex flex-wrap gap-2">
              {contextualQuickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  disabled={isSending}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-60"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {error && (
              <div className="mb-3 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex gap-3">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value.slice(0, MAX_MESSAGE_CHARS))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                  placeholder="Digite sua dúvida..."
                className="min-h-[52px] resize-none"
              />
              <Button type="submit" className="h-[52px] px-4" disabled={isSending || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Enter envia, Shift + Enter quebra linha.</span>
              <span>{input.length}/{MAX_MESSAGE_CHARS}</span>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/50 p-5">
            <div className="mb-4 flex items-center gap-2">
              <CircleHelp className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-foreground">FAQ rápido</h2>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={faqSearch}
                onChange={(event) => setFaqSearch(event.target.value)}
                placeholder="Buscar no FAQ"
                className="pl-9"
              />
            </div>

            <Accordion type="single" collapsible className="w-full">
              {filteredFaqItems.map((item) => (
                <AccordionItem key={item.title} value={item.title}>
                  <AccordionTrigger className="gap-3 py-3 text-left hover:no-underline">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                        <item.icon className="h-4 w-4 text-primary" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold uppercase tracking-wider text-primary">
                          {item.category}
                        </span>
                        <span className="block text-sm font-medium text-foreground">{item.title}</span>
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pl-11 text-xs leading-relaxed text-muted-foreground">
                    {item.text}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {filteredFaqItems.length === 0 && (
              <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                Nenhum item encontrado. Pergunte ao assistente no chat.
              </p>
            )}
          </Card>

          <Card className="border-border/50 p-5">
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-foreground">Contexto conectado</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {latestAnalysis
                ? "O chat pode considerar sua análise mais recente para responder com mais precisão."
                : "Envie um currículo para receber respostas mais personalizadas sobre sua carreira."}
            </p>
            <div className="mt-4 space-y-3">
              {latestAnalysis && (
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <p className="truncate text-sm font-medium text-foreground">
                    {latestAnalysis.file_name}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="secondary">ATS {latestAnalysis.ats_score || 0}</Badge>
                    <Badge variant="secondary">{latestAnalysis.main_area || "Área não identificada"}</Badge>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <p className="text-sm font-medium text-foreground">
                  {profile?.targetRole || profile?.headline || "Perfil ainda incompleto"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[profile?.experienceLevel, profile?.location].filter(Boolean).join(" • ") ||
                    "Complete cargo, nível e localização para melhorar o contexto."}
                </p>
              </div>
            </div>
            {!latestAnalysis && (
              <Link to="/upload">
                <Button className="mt-4 w-full" size="sm">
                  Enviar currículo
                </Button>
              </Link>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
