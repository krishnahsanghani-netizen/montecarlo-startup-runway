"use client";

import { useEffect, useState } from "react";

const THEME_KEY = "mc_theme";

function applyTheme(theme: "light" | "dark") {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const stored = (window.localStorage.getItem(THEME_KEY) as "light" | "dark" | null) ?? "dark";
    setTheme(stored);
    applyTheme(stored);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    window.localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  return (
    <button
      onClick={toggle}
      className="rounded border border-slate-300 bg-slate-100 px-2 py-1 text-xs text-slate-900 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
      type="button"
    >
      {theme === "dark" ? "Dark" : "Light"}
    </button>
  );
}
