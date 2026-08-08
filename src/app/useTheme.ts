import { useCallback, useEffect, useRef, useState } from 'react';

import { THEME_STORAGE_KEY } from '#entities/bondCalculation';

export type Theme = 'light' | 'dark';

const getSystemTheme = (): Theme => window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

const readTheme = (): Theme | null => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch { return null; }
};

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const documentTheme = document.documentElement.dataset.theme;
    return documentTheme === 'dark' || documentTheme === 'light' ? documentTheme : readTheme() ?? getSystemTheme();
  });
  const manualChoice = useRef(readTheme() !== null);

  const applyTheme = useCallback((next: Theme) => {
    document.documentElement.dataset.theme = next;
    setTheme(next);
  }, []);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      if (!manualChoice.current) applyTheme(event.matches ? 'dark' : 'light');
    };
    media?.addEventListener('change', handleChange);
    return () => media?.removeEventListener('change', handleChange);
  }, [applyTheme]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    manualChoice.current = true;
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* Theme still works in this tab. */ }
    applyTheme(next);
  };

  return { theme, toggleTheme };
}
