"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

const STORAGE_KEY = "coordinaciones-wn-theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(STORAGE_KEY);
    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
      document.documentElement.dataset.theme = savedTheme;
    } else {
      document.documentElement.dataset.theme = "dark";
    }
  }, []);

  function cambiarTema() {
    const nuevoTema = theme === "dark" ? "light" : "dark";
    setTheme(nuevoTema);
    document.documentElement.dataset.theme = nuevoTema;
    window.localStorage.setItem(STORAGE_KEY, nuevoTema);
  }

  const activarTema = theme === "dark" ? "claro" : "oscuro";

  return (
    <button
      className={`theme-toggle theme-toggle-switch theme-is-${theme}`}
      type="button"
      onClick={cambiarTema}
      aria-label={`Activar modo ${activarTema}`}
      title={`Activar modo ${activarTema}`}
      aria-pressed={theme === "light"}
    >
      <span className="theme-toggle-sun" aria-hidden="true">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>
      </span>
      <span className="theme-toggle-moon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M20.4 15.2A8.5 8.5 0 0 1 8.8 3.6 8.5 8.5 0 1 0 20.4 15.2Z" /></svg>
      </span>
    </button>
  );
}
