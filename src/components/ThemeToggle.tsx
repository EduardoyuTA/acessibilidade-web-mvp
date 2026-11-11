import React, { useEffect, useState } from "react";
import { Icon } from "./icons.tsx";

export const THEME_KEY = "acessoclaro-tema";

function systemPrefersDark() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function storedTheme(): "dark" | "light" | null {
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch {
    return null;
  }
}

/** Alterna entre claro e escuro; sem escolha salva, acompanha o sistema. */
export function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    const stored = storedTheme();
    return stored ? stored === "dark" : systemPrefersDark();
  });

  // Enquanto a pessoa não escolher, muda junto com o sistema.
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;
    const onChange = () => {
      if (!storedTheme()) setDark(media.matches);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    const theme = next ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* preferência só desta sessão */
    }
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-pressed={dark}
      onClick={toggle}
      title={dark ? "Usar modo claro" : "Usar modo escuro"}
    >
      <span className="theme-icon" key={dark ? "moon" : "sun"} aria-hidden="true">
        <Icon name={dark ? "moon" : "sun"} size={20} />
      </span>
      <span className="sr-only">Modo escuro</span>
    </button>
  );
}
