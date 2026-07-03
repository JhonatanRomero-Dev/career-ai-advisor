import React, { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import NotificationsPopover from "@/components/notifications/NotificationsPopover";
import Sidebar from "./Sidebar";
import RouteTransitionLoader from "./RouteTransitionLoader";
import { base44 } from "@/api/base44Client";
import { readAuthSession } from "@/lib/authSession";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  "/history": ["Histórico", "Compare suas análises salvas"],
  "/jobs": ["Vagas", "Explore oportunidades compatíveis"],
  "/profile": ["Perfil", "Mantenha seus dados profissionais atualizados"],
  "/support": ["Suporte IA", "Tire dúvidas com contexto do seu perfil"],
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
  const [title, subtitle] = useMemo(
    () => pageTitles[location.pathname] || ["Career AI", "Seu painel de carreira com IA"],
    [location.pathname]
  );
  const user = session.user || {};
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

  return (
    <div className="min-h-screen bg-background flex">
      <RouteTransitionLoader
        routeKey={`${location.pathname}${location.search}`}
        pathname={location.pathname}
      />
      
      <Sidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />

      <main
        className={`flex-1 p-4 pb-24 transition-[margin] duration-300 sm:p-6 md:pb-6 lg:p-8 ${
          sidebarCollapsed ? "md:ml-16" : "md:ml-64"
        }`}
      >
        <div className="mb-6 flex flex-col gap-4 border-b border-border/60 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-foreground">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/">
                <Home className="h-4 w-4" />
                Início
              </Link>
            </Button>

            <Button asChild size="sm" className="gap-2">
              <Link to="/upload">
                <FileUp className="h-4 w-4" />
                Nova análise
              </Link>
            </Button>

            <Badge variant={isPremium ? "default" : "secondary"} className="h-9 gap-1.5 px-3">
              <ShieldCheck className="h-3.5 w-3.5" />
              {planLabel}
            </Badge>

            <NotificationsPopover />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" className="h-10 gap-2 px-2">
                  <Avatar className="h-8 w-8">
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
      </main>

    </div>
  );
}
