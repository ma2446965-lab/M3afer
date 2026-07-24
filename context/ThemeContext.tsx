"use client";
import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isFabVisible: boolean;
  setFabVisible: (visible: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
  isFabVisible: true,
  setFabVisible: () => {}
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [isFabVisible, setFabVisible] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem("meafer-theme") as Theme;
    const savedFab = localStorage.getItem("meafer-fab-visible");

    if (savedTheme) setTheme(savedTheme);
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches) setTheme("dark");

    if (savedFab !== null) setFabVisible(savedFab !== "false");
  }, []);

  useEffect(() => {
    localStorage.setItem("meafer-theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("meafer-fab-visible", String(isFabVisible));
  }, [isFabVisible]);

  const toggleTheme = () => setTheme(prev => prev === "light" ? "dark" : "light");

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isFabVisible, setFabVisible }}>
      {children}
    </ThemeContext.Provider>
  );
}
