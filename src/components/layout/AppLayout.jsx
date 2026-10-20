import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import NotificationsPopover from "@/components/notifications/NotificationsPopover";
import Sidebar from "./Sidebar";
import RouteTransitionLoader from "./RouteTransitionLoader";
import OnboardingDialog from "@/components/onboarding/OnboardingDialog";
import { base44 } from "@/api/base44Client";
import { readAuthSession } from "@/lib/authSession";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileUp, Home, LogOut, ShieldCheck, User } from "lucide-react";

const pageTitles = {
  "/dashboard": ["Painel", "Acompanhe sua evolução profissional"],
  "/upload": ["Enviar currículo", "Analise uma nova versão do seu currículo"],
  "/analysis": ["Relatório", "Veja os pontos fortes e prioridades de melhoria"],
  "/resume": ["Currículo", "Versões e revisão"],
  "/history": ["Histórico", "Compare suas análises salvas"],
  "/jobs": ["Vagas", "Explore oportunidades compatíveis"],
  "/profile": ["Perfil", "Gerencie seus dados profissionais para personalizar análises e vagas"],
  "/support": ["Suporte IA", "Tire dúvidas com contexto do seu perfil"],
  "/feedback": ["Feedback", "Ajude a melhorar sua experiência"],
  "/admin": ["Admin", "Monitore operação, pagamentos e privacidade"],
};

function getInitials(user = {}) {
  const label = user.name || user.email || "Usuário";
  const parts = String(label).trim().split(/\s+/).filter(Boolean);

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatPlan(plan = "Gratis") {
  const normalized = String(plan || "Gratis").toLowerCase();

  if (normalized === "pro") return "Pro";
  if (normalized === "premium") return "Premium";

  return "Gratuito";
}

export default function AppLayout({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [session, setSession] = useState(() => readAuthSession());
  const [subscription, setSubscription] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [title, subtitle] = useMemo(
    () => pageTitles[location.pathname] || ["Career AI", "Seu painel de carreira com IA"],
    [location.pathname]
  );
  const user = session.user || {};
  const { data: profile } = useQuery({
    queryKey: ["user-profile", user.email],
    queryFn: () => base44.auth.getProfile(),
    enabled: Boolean(user.email),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const planLabel = formatPlan(subscription?.plan);
  const isPremium = ["pro", "premium"].includes(String(subscription?.plan || "").toLowerCase());

  useEffect(() => {
    setSession(readAuthSession());

    let active = true;

    base44.subscription.getCurrent()
      .then((currentSubscription) => {
        if (active) {
          setSubscription(currentSubscription);
        }
      })
      .catch((error) => {
        console.warn("Não foi possível carregar assinatura:", error);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const checkoutState = params.get("checkout");
    const checkoutId = params.get("checkout_id") || params.get("external_reference");
    const paymentId = params.get("payment_id") || params.get("collection_id");

    if (!checkoutState || !checkoutId) {
      return undefined;
    }

    let active = true;

    base44.subscription.getCheckoutStatus(checkoutId, { paymentId })
      .then(({ subscription: currentSubscription }) => {
        if (active && currentSubscription) {
          setSubscription(currentSubscription);
        }
      })
      .catch((error) => {
        console.warn("Nao foi possivel conferir o pagamento:", error);
      })
      .finally(() => {
        if (active) {
          navigate(location.pathname || "/dashboard", { replace: true });
        }
      });

    return () => {
      active = false;
    };
  }, [location.pathname, location.search, navigate]);

  return (
    <div className="min-h-screen bg-background flex">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-[100] rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only"
      >
        Ir para o conteúdo principal
      </a>
      {location.pathname === "/dashboard" && <OnboardingDialog user={user} />}
      <RouteTransitionLoader
        routeKey={`${location.pathname}${location.search}`}
        pathname={location.pathname}
      />
      
      <Sidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />

      <main
        id="main-content"
        tabIndex={-1}
        className={`flex-1 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] transition-[margin] duration-300 sm:p-6 md:pb-6 lg:p-8 ${
          sidebarCollapsed ? "md:ml-16" : "md:ml-64"
        }`}
      >
        <div className="mx-auto w-full max-w-7xl">
        <div className="mb-5 flex flex-col gap-3 border-b border-border/60 pb-4 sm:mb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-foreground sm:text-2xl">{title}</h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
          </div>

          <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
            <Button asChild variant="outline" size="sm" className="w-full gap-2 sm:w-auto">
              <Link to="/">
                <Home className="h-4 w-4" />
                Início
              </Link>
            </Button>

            <Button asChild size="sm" className="w-full gap-2 sm:w-auto">
              <Link to="/upload">
                <FileUp className="h-4 w-4" />
                Nova análise
              </Link>
            </Button>

            <Badge variant={isPremium ? "default" : "secondary"} className="hidden h-9 gap-1.5 px-3 sm:flex">
              <ShieldCheck className="h-3.5 w-3.5" />
              {planLabel}
            </Badge>

            <div className="justify-self-end sm:justify-self-auto"><NotificationsPopover /></div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" className="h-11 gap-2 px-2 sm:h-10">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.photo || undefined} alt="Foto da sua conta" className="object-cover" />
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {getInitials(user)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">
                    {user.name || user.email || "Conta"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <span className="block truncate">{user.name || "Minha conta"}</span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {user.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile">
                    <User className="h-4 w-4" />
                    Perfil e dados
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => base44.auth.logout()}>
                  <LogOut className="h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {children ?? <Outlet />}
        </div>
      </main>

    </div>
  );
}
