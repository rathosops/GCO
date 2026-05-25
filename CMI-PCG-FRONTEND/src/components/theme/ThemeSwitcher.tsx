// src/components/theme/ThemeSwitcher.tsx
import { useState, useRef, useEffect } from "react";
import { Palette, Sun, Moon, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";

export default function ThemeSwitcher() {
  const { theme, toggle, paletteId, palettes, setPalette } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-2 hover:bg-bg-200 rounded-xl transition-colors"
        aria-label="Personalizar tema"
        title="Personalizar tema"
        type="button"
      >
        <Palette className="h-5 w-5 text-text-200" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-72 bg-bg-100 border border-bg-300 rounded-2xl p-4 z-50"
            style={{ boxShadow: "var(--shadow-md)" }}
          >
            {/* ── Modo claro/escuro ── */}
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-bg-300">
              <span className="text-xs font-semibold text-text-200 uppercase tracking-wider">
                Modo
              </span>
              <button
                onClick={toggle}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-200 text-sm font-medium text-text-100 hover:bg-bg-300 transition-colors"
                type="button"
              >
                {theme === "dark" ? (
                  <>
                    <Moon className="h-3.5 w-3.5" /> Escuro
                  </>
                ) : (
                  <>
                    <Sun className="h-3.5 w-3.5" /> Claro
                  </>
                )}
              </button>
            </div>

            {/* ── Paletas ── */}
            <span className="text-xs font-semibold text-text-200 uppercase tracking-wider">
              Paleta de cores
            </span>

            <div className="grid grid-cols-4 gap-1.5 mt-2">
              {palettes.map((p) => {
                const active = p.id === paletteId;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPalette(p.id)}
                    className={`
                      relative flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all
                      ${
                        active
                          ? "border-primary-100 bg-bg-200"
                          : "border-transparent hover:bg-bg-200"
                      }
                    `}
                    type="button"
                    title={p.label}
                  >
                    {/* Bolinha de preview = primary color */}
                    <span
                      className="w-6 h-6 rounded-full border border-bg-300"
                      style={{ background: p.preview }}
                    />
                    <span className="text-[9px] font-medium text-text-200 leading-none truncate w-full text-center">
                      {p.emoji} {p.label}
                    </span>
                    {active && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary-100 flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
