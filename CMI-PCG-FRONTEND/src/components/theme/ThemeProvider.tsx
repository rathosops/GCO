// src/components/theme/ThemeProvider.tsx
import React, { createContext, useContext } from "react";
import { ThemeMode, useThemeController, ThemePalette } from "@/hooks/useTheme";

type ThemeContextValue = {
  theme: ThemeMode;
  paletteId: string;
  palette: ThemePalette;
  palettes: ThemePalette[];
  setTheme: (t: ThemeMode) => void;
  setLight: () => void;
  setDark: () => void;
  toggle: () => void;
  setPalette: (id: string) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const controller = useThemeController();
  return (
    <ThemeContext.Provider value={controller}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
