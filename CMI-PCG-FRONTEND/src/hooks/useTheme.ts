// src/hooks/useTheme.ts
import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

/**
 * DARK MODE BEST PRACTICES aplicadas em TODAS as paletas:
 * ────────────────────────────────────────────────────────
 * 1. bg-100 = base surface (mais escuro). NUNCA #000000 puro.
 * 2. bg-200 = elevated surface (ligeiramente mais claro que bg-100).
 * 3. bg-300 = highest elevation / borders (ainda mais claro → profundidade).
 *    → No dark: quanto MAIS elevado, MAIS CLARO (inverso do light).
 *
 * 4. text-100 = off-white (#dce0e8 range). NUNCA #ffffff puro.
 * 5. text-200 = secondary text = cinza médio. Contraste mínimo 4.5:1 vs bg-100.
 *
 * 6. primary no dark = desaturado ~20% e clareado vs light.
 * 7. accent-100 no dark = superfície escura sutil (NUNCA cor clara).
 * 8. accent-200 no dark = tom muted para elementos terciários.
 */

export interface ThemePalette {
  id: string;
  label: string;
  emoji: string;
  preview: string;
  light: Record<string, string>;
  dark: Record<string, string>;
}

export const THEME_PALETTES: ThemePalette[] = [
  {
    id: 'tangerine',
    label: 'Tangerina',
    emoji: '🍊',
    preview: '#e85d04',
    light: {
      '--primary-100': '#e85d04',
      '--primary-200': '#f48c3c',
      '--primary-300': '#fff2e6',
      '--accent-100': '#f5f5f5',
      '--accent-200': '#8c8c8c',
      '--text-100': '#1a1c1e',
      '--text-200': '#5c5e62',
      '--bg-100': '#ffffff',
      '--bg-200': '#f7f7f8',
      '--bg-300': '#dcdde0',
    },
    dark: {
      '--primary-100': '#f48c3c',
      '--primary-200': '#ffb070',
      '--primary-300': '#2e1a08',
      '--accent-100': '#1e2024',
      '--accent-200': '#6e7178',
      '--text-100': '#e4e6e9',
      '--text-200': '#9a9da4',
      '--bg-100': '#131416',
      '--bg-200': '#1c1d21',
      '--bg-300': '#2e3035',
    },
  },
  {
    id: 'ocean',
    label: 'Oceano',
    emoji: '🌊',
    preview: '#0077CC',
    light: {
      '--primary-100': '#0070c0',
      '--primary-200': '#3d99db',
      '--primary-300': '#e6f2fb',
      '--accent-100': '#f0f5fa',
      '--accent-200': '#7a93a8',
      '--text-100': '#172533',
      '--text-200': '#4a6075',
      '--bg-100': '#ffffff',
      '--bg-200': '#f5f8fb',
      '--bg-300': '#d6dfe8',
    },
    dark: {
      '--primary-100': '#4da6e8',
      '--primary-200': '#7ec4f5',
      '--primary-300': '#0c1f30',
      '--accent-100': '#161e28',
      '--accent-200': '#5a7088',
      '--text-100': '#dce6f0',
      '--text-200': '#8a9bac',
      '--bg-100': '#0e1318',
      '--bg-200': '#161d24',
      '--bg-300': '#243040',
    },
  },
  {
    id: 'forest',
    label: 'Floresta',
    emoji: '🌲',
    preview: '#2d8c4e',
    light: {
      '--primary-100': '#278a48',
      '--primary-200': '#4aad6b',
      '--primary-300': '#e6f7ed',
      '--accent-100': '#f0f7f2',
      '--accent-200': '#6f9a7e',
      '--text-100': '#162b1d',
      '--text-200': '#466b52',
      '--bg-100': '#ffffff',
      '--bg-200': '#f4f9f6',
      '--bg-300': '#cfe0d5',
    },
    dark: {
      '--primary-100': '#4bc076',
      '--primary-200': '#72d898',
      '--primary-300': '#0e2416',
      '--accent-100': '#151f18',
      '--accent-200': '#4e7a5c',
      '--text-100': '#daeee2',
      '--text-200': '#89aa94',
      '--bg-100': '#0d120f',
      '--bg-200': '#151d18',
      '--bg-300': '#233028',
    },
  },
  {
    id: 'lavender',
    label: 'Lavanda',
    emoji: '💜',
    preview: '#7c3aed',
    light: {
      '--primary-100': '#7240d4',
      '--primary-200': '#9b72e8',
      '--primary-300': '#f0eafc',
      '--accent-100': '#f5f2fc',
      '--accent-200': '#8878a8',
      '--text-100': '#1c1530',
      '--text-200': '#594e72',
      '--bg-100': '#ffffff',
      '--bg-200': '#f8f6fc',
      '--bg-300': '#dad4e8',
    },
    dark: {
      '--primary-100': '#a07cf0',
      '--primary-200': '#c0a8f8',
      '--primary-300': '#1e1530',
      '--accent-100': '#1a1624',
      '--accent-200': '#6d6090',
      '--text-100': '#e4dff0',
      '--text-200': '#9990b0',
      '--bg-100': '#110f18',
      '--bg-200': '#1a1722',
      '--bg-300': '#2a2638',
    },
  },
  {
    id: 'graphite',
    label: 'Grafite',
    emoji: '⚙️',
    preview: '#525866',
    light: {
      '--primary-100': '#4a5060',
      '--primary-200': '#6e7588',
      '--primary-300': '#ecedf0',
      '--accent-100': '#f2f3f5',
      '--accent-200': '#888d98',
      '--text-100': '#1a1c22',
      '--text-200': '#555962',
      '--bg-100': '#ffffff',
      '--bg-200': '#f5f5f7',
      '--bg-300': '#d5d6da',
    },
    dark: {
      '--primary-100': '#8a90a0',
      '--primary-200': '#aab0bc',
      '--primary-300': '#1a1c22',
      '--accent-100': '#1a1c20',
      '--accent-200': '#5a5e68',
      '--text-100': '#dcdee4',
      '--text-200': '#888c96',
      '--bg-100': '#111214',
      '--bg-200': '#1a1b1e',
      '--bg-300': '#282a2f',
    },
  },
  {
    id: 'rose',
    label: 'Rosé',
    emoji: '🌸',
    preview: '#d63384',
    light: {
      '--primary-100': '#cc2d7a',
      '--primary-200': '#e8609e',
      '--primary-300': '#fce8f2',
      '--accent-100': '#fdf2f6',
      '--accent-200': '#a87890',
      '--text-100': '#2a1220',
      '--text-200': '#6e4458',
      '--bg-100': '#ffffff',
      '--bg-200': '#fdf7f9',
      '--bg-300': '#e8d2dc',
    },
    dark: {
      '--primary-100': '#e86aa8',
      '--primary-200': '#f098c4',
      '--primary-300': '#2a0e1c',
      '--accent-100': '#201018',
      '--accent-200': '#8a5878',
      '--text-100': '#f0dce6',
      '--text-200': '#a88898',
      '--bg-100': '#140c10',
      '--bg-200': '#1e1418',
      '--bg-300': '#322430',
    },
  },
  {
    id: 'indigo',
    label: 'Índigo',
    emoji: '🔮',
    preview: '#4f46e5',
    light: {
      '--primary-100': '#4840d8',
      '--primary-200': '#7470f0',
      '--primary-300': '#eeedfc',
      '--accent-100': '#f2f1fc',
      '--accent-200': '#807cb5',
      '--text-100': '#151330',
      '--text-200': '#4a4870',
      '--bg-100': '#ffffff',
      '--bg-200': '#f7f7fc',
      '--bg-300': '#d8d6ec',
    },
    dark: {
      '--primary-100': '#7c78f0',
      '--primary-200': '#a6a2f8',
      '--primary-300': '#161430',
      '--accent-100': '#161424',
      '--accent-200': '#5c5890',
      '--text-100': '#e2e0f4',
      '--text-200': '#908cb4',
      '--bg-100': '#0e0d16',
      '--bg-200': '#16151f',
      '--bg-300': '#262438',
    },
  },
  {
    id: 'copper',
    label: 'Cobre',
    emoji: '🪙',
    preview: '#b5651d',
    light: {
      '--primary-100': '#a85c1a',
      '--primary-200': '#cc8844',
      '--primary-300': '#faf0e4',
      '--accent-100': '#f8f3ed',
      '--accent-200': '#9a8a74',
      '--text-100': '#28200e',
      '--text-200': '#6e6050',
      '--bg-100': '#ffffff',
      '--bg-200': '#faf8f5',
      '--bg-300': '#e2dbd2',
    },
    dark: {
      '--primary-100': '#d4944c',
      '--primary-200': '#e8b87c',
      '--primary-300': '#2a1c08',
      '--accent-100': '#201a12',
      '--accent-200': '#8a7460',
      '--text-100': '#ece4d8',
      '--text-200': '#a89880',
      '--bg-100': '#14110c',
      '--bg-200': '#1e1a14',
      '--bg-300': '#302a20',
    },
  },
  {
    id: 'cyan',
    label: 'Ciano',
    emoji: '🧊',
    preview: '#0891b2',
    light: {
      '--primary-100': '#0882a4',
      '--primary-200': '#2cb0d0',
      '--primary-300': '#e4f6fb',
      '--accent-100': '#eef8fb',
      '--accent-200': '#6a98aa',
      '--text-100': '#0e252e',
      '--text-200': '#3e6474',
      '--bg-100': '#ffffff',
      '--bg-200': '#f4fafb',
      '--bg-300': '#cee0e6',
    },
    dark: {
      '--primary-100': '#38c4e0',
      '--primary-200': '#6cd8f0',
      '--primary-300': '#082028',
      '--accent-100': '#101c22',
      '--accent-200': '#4a808e',
      '--text-100': '#d8eef4',
      '--text-200': '#82aab8',
      '--bg-100': '#0a1014',
      '--bg-200': '#121c22',
      '--bg-300': '#1e3038',
    },
  },
  {
    id: 'crimson',
    label: 'Carmesim',
    emoji: '🔴',
    preview: '#dc2626',
    light: {
      '--primary-100': '#cc2222',
      '--primary-200': '#e85454',
      '--primary-300': '#fdeaea',
      '--accent-100': '#fcf0f0',
      '--accent-200': '#b07878',
      '--text-100': '#2a1010',
      '--text-200': '#704040',
      '--bg-100': '#ffffff',
      '--bg-200': '#fdf7f7',
      '--bg-300': '#ecd4d4',
    },
    dark: {
      '--primary-100': '#f06060',
      '--primary-200': '#f89090',
      '--primary-300': '#2e0e0e',
      '--accent-100': '#221414',
      '--accent-200': '#905050',
      '--text-100': '#f4dede',
      '--text-200': '#b08888',
      '--bg-100': '#160c0c',
      '--bg-200': '#201212',
      '--bg-300': '#362222',
    },
  },
  {
    id: 'midnight',
    label: 'Meia-noite',
    emoji: '🌙',
    preview: '#1e3a5f',
    light: {
      '--primary-100': '#1e3a5f',
      '--primary-200': '#3c6090',
      '--primary-300': '#e8eff7',
      '--accent-100': '#f0f3f8',
      '--accent-200': '#7a8ea0',
      '--text-100': '#111d2b',
      '--text-200': '#4a5d70',
      '--bg-100': '#ffffff',
      '--bg-200': '#f4f6f9',
      '--bg-300': '#d0d8e2',
    },
    dark: {
      '--primary-100': '#5a8cc0',
      '--primary-200': '#84aed8',
      '--primary-300': '#0e1a28',
      '--accent-100': '#131a24',
      '--accent-200': '#4a6880',
      '--text-100': '#d6e0ea',
      '--text-200': '#8a9aac',
      '--bg-100': '#0a0f14',
      '--bg-200': '#121820',
      '--bg-300': '#1e2a38',
    },
  },
  {
    id: 'emerald',
    label: 'Esmeralda',
    emoji: '💎',
    preview: '#059669',
    light: {
      '--primary-100': '#058c60',
      '--primary-200': '#2ab888',
      '--primary-300': '#e4f8f0',
      '--accent-100': '#eefaf5',
      '--accent-200': '#62a08a',
      '--text-100': '#0c2820',
      '--text-200': '#3a6858',
      '--bg-100': '#ffffff',
      '--bg-200': '#f4fbf8',
      '--bg-300': '#c8e4d8',
    },
    dark: {
      '--primary-100': '#34d89a',
      '--primary-200': '#68e8b8',
      '--primary-300': '#082e1e',
      '--accent-100': '#101e18',
      '--accent-200': '#3e8068',
      '--text-100': '#d4f2e6',
      '--text-200': '#7eb8a0',
      '--bg-100': '#0a100e',
      '--bg-200': '#121e18',
      '--bg-300': '#1e3428',
    },
  },
];

const STORAGE_KEY_MODE = 'cmi-theme-mode';
const STORAGE_KEY_PALETTE = 'cmi-theme-palette';

function getStored<T extends string>(key: string, fallback: T): T {
  try { return (localStorage.getItem(key) as T) || fallback; }
  catch { return fallback; }
}

function applyToDOM(mode: ThemeMode, palette: ThemePalette) {
  const root = document.documentElement;
  root.setAttribute('data-theme', mode);
  const vars = mode === 'dark' ? palette.dark : palette.light;
  Object.entries(vars).forEach(([prop, value]) => root.style.setProperty(prop, value));
}

export function useThemeController() {
  const [mode, setModeState] = useState<ThemeMode>(() => getStored(STORAGE_KEY_MODE, 'light'));
  const [paletteId, setPaletteIdState] = useState<string>(() => getStored(STORAGE_KEY_PALETTE, 'tangerine'));

  const palette = THEME_PALETTES.find((p) => p.id === paletteId) ?? THEME_PALETTES[0]!;

  useEffect(() => {
    applyToDOM(mode, palette);
    try {
      localStorage.setItem(STORAGE_KEY_MODE, mode);
      localStorage.setItem(STORAGE_KEY_PALETTE, palette.id);
    } catch { /* silencioso */ }
  }, [mode, palette]);

  const setTheme = useCallback((m: ThemeMode) => setModeState(m), []);
  const setLight = useCallback(() => setModeState('light'), []);
  const setDark = useCallback(() => setModeState('dark'), []);
  const toggle = useCallback(() => setModeState((p) => (p === 'light' ? 'dark' : 'light')), []);
  const setPalette = useCallback((id: string) => {
    if (THEME_PALETTES.some((p) => p.id === id)) setPaletteIdState(id);
  }, []);

  return { theme: mode, paletteId: palette.id, palette, palettes: THEME_PALETTES, setTheme, setLight, setDark, toggle, setPalette };
}