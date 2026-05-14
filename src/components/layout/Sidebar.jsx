import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Upload, History, Briefcase, Sparkles,
  ChevronLeft, ChevronRight, LogOut, Crown, User } from
"lucide-react";
import { base44 } from "@/api/base44Client";
import UpgradeModal from "./UpgradeModal";
import ThemeToggle from "@/components/theme/ThemeToggle";

const navItems = [
{ icon: LayoutDashboard, label: "Painel", path: "/dashboard" },
{ icon: Upload, label: "Enviar curriculo", path: "/upload" },
{ icon: History, label: "Historico de analises", path: "/history" },
{ icon: Briefcase, label: "Vagas compativeis", path: "/jobs" },
{ icon: User, label: "Perfil", path: "/profile" }];


export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const location = useLocation();

  return (
    <aside className={`fixed left-0 top-0 h-full bg-sidebar text-sidebar-foreground z-40 transition-all duration-300 flex flex-col ${collapsed ? 'w-16' : 'w-64'}`}>
      <Link to="/" className="p-4 flex items-center gap-3 border-b border-sidebar-border hover:bg-sidebar-accent transition-colors">
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
            <p className="text-xs text-sidebar-foreground/60 mb-2">Libere analises ilimitadas e vagas premium.</p>
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
    </aside>);

}
