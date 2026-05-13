'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const THEME_CYCLE = ['dark', 'mono', 'light'];

const ThemeContext = createContext({
  theme: 'dark',
  toggleTheme: () => {},
  isDark: true,
  isMono: false,
});

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('kodek-theme');
    if (savedTheme && THEME_CYCLE.includes(savedTheme)) {
      setTheme(savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      setTheme('light');
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove('dark', 'light', 'mono');
    document.documentElement.classList.add(theme);
    localStorage.setItem('kodek-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => {
      const idx = THEME_CYCLE.indexOf(prev);
      return THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === 'dark', isMono: theme === 'mono' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext); 