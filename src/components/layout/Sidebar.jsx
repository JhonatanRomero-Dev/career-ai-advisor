import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Upload, History, Briefcase, Sparkles,
  ChevronLeft, ChevronRight, LogOut, Crown, User, LifeBuoy } from
"lucide-react";
import { base44 } from "@/api/base44Client";
import UpgradeModal from "./UpgradeModal";
import ThemeToggle from "@/components/theme/ThemeToggle";

const navItems = [
{ icon: LayoutDashboard, label: "Painel", path: "/dashboard" },
{ icon: Upload, label: "Enviar currículo", path: "/upload" },
{ icon: History, label: "Histórico de análises", path: "/history" },
{ icon: Briefcase, label: "Vagas compatíveis", path: "/jobs" },
{ icon: User, label: "Perfil", path: "/profile" },
{ icon: LifeBuoy, label: "Suporte IA", path: "/support" }];


export default function Sidebar({ collapsed = false, onCollapsedChange }) {
  const [showUpgrade, setShowUpgrade] = useState(false);
  const location = useLocation();
  const setCollapsed = (value) => {
    onCollapsedChange?.(value);
  };

  return (
    <>
    <aside className={`fixed left-0 top-0 z-40 hidden h-full flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 md:flex ${collapsed ? 'w-16' : 'w-64'}`}>
      <Link to="/dashboard" className="p-4 flex items-center gap-3 border-b border-sidebar-border hover:bg-sidebar-accent transition-colors">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-primary-foreground" />
        </div>
        {!collapsed &&
        <span className="font-bold text-lg tracking-tight whitespace-nowrap">Career AI</span>
        }
      </Link>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              isActive ?
              'bg-sidebar-primary text-sidebar-primary-foreground' :
              'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent'}`
              }>
              
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>);

        })}
      </nav>

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />

      <div className="p-3 space-y-2 border-t border-sidebar-border">
        {!collapsed &&
        <div className="p-3 rounded-lg bg-sidebar-accent">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-4 h-4 text-yellow-400" />
              <span className="text-xs font-semibold">Assine o Pro</span>
            </div>
            <p className="text-xs text-sidebar-foreground/60 mb-2">Libere análises ilimitadas e vagas premium.</p>
            <button
              onClick={() => setShowUpgrade(true)}
              className="w-full text-xs py-1.5 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors">
              Ver planos
            </button>
          </div>
        }
        <ThemeToggle
          collapsed={collapsed}
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        />
        <button
          onClick={() => base44.auth.logout()}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all w-full">
          
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-2 rounded-lg text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all">
          
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>

    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-2 py-2 shadow-lg backdrop-blur md:hidden">
      <div className="grid grid-cols-6 gap-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              aria-label={item.label}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              <span className="max-w-full truncate">{item.label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </div>
    </nav>
    </>);

}
 
