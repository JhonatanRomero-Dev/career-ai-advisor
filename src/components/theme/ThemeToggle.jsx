import React, { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const THEME_KEY = "theme";

function getStoredTheme() {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem(THEME_KEY) || "light";
}

function applyTheme(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(THEME_KEY, theme);
  window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
}

export default function ThemeToggle({ collapsed = false, className = "" }) {
  const [theme, setTheme] = useState(getStoredTheme);
  const isDark = theme === "dark";

  useEffect(() => {
    const currentTheme = getStoredTheme();
    setTheme(currentTheme);
    document.documentElement.classList.toggle("dark", currentTheme === "dark");

    const handleThemeChange = (event) => {
      setTheme(event.detail || getStoredTheme());
    };

    window.addEventListener("themechange", handleThemeChange);
    return () => window.removeEventListener("themechange", handleThemeChange);
  }, []);

  const toggleTheme = () => {
    const nextTheme = isDark ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size={collapsed ? "icon" : "sm"}
      onClick={toggleTheme}
      aria-label={isDark ? "Ativar modo claro" : "Ativar modo noturno"}
      title={isDark ? "Ativar modo claro" : "Ativar modo noturno"}
      className={`gap-3 ${className}`}
    >
      {isDark ? (
        <Sun className="w-4 h-4 flex-shrink-0" />
      ) : (
        <Moon className="w-4 h-4 flex-shrink-0" />
      )}
      {!collapsed && <span>{isDark ? "Modo claro" : "Modo noturno"}</span>}
    </Button>
  );
}
