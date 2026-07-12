"use client";
import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
type Language = "ar" | "en";

interface ThemeContextType {
  theme: Theme;
  language: Language;
  toggleTheme: () => void;
  setLanguage: (lang: Language) => void;
  isFabVisible: boolean;
  setFabVisible: (visible: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  language: "ar",
  toggleTheme: () => {},
  setLanguage: () => {},
  isFabVisible: true,
  setFabVisible: () => {}
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [language, setLanguage] = useState<Language>("ar");
  const [isFabVisible, setFabVisible] = useState(true);

  useEffect(() => {
    const savedTheme = localStorage.getItem("meafer-theme") as Theme;
    const savedLang = localStorage.getItem("meafer-lang") as Language;
    const savedFab = localStorage.getItem("meafer-fab-visible");
    
    if (savedTheme) setTheme(savedTheme);
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches) setTheme("dark");
    
    if (savedLang) setLanguage(savedLang);
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
    localStorage.setItem("meafer-lang", language);
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    localStorage.setItem("meafer-fab-visible", String(isFabVisible));
  }, [isFabVisible]);

  const toggleTheme = () => setTheme(prev => prev === "light" ? "dark" : "light");

  return (
    <ThemeContext.Provider value={{ theme, language, toggleTheme, setLanguage, isFabVisible, setFabVisible }}>
      {children}
    </ThemeContext.Provider>
  );
}
