import { useEffect, useState, useCallback } from 'react';

export type Theme = 'dark' | 'light' | 'system';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem('jarvis-theme');
      if (stored === 'dark' || stored === 'light' || stored === 'system') return stored;
    } catch {}
    return 'system';
  });

  const getResolvedTheme = useCallback((currentTheme: Theme): 'dark' | 'light' => {
    if (currentTheme === 'system') {
      return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    return currentTheme;
  }, []);

  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>(() => getResolvedTheme(theme));

  const applyTheme = useCallback((targetTheme: Theme) => {
    const resolved = getResolvedTheme(targetTheme);
    setResolvedTheme(resolved);
    const root = document.documentElement;
    root.setAttribute('data-theme', resolved);
    if (resolved === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('jarvis-theme', targetTheme);
    } catch {}
  }, [getResolvedTheme]);

  const setTheme = useCallback((newTheme: Theme, event?: React.MouseEvent) => {
    setThemeState(newTheme);

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const supportsViewTransitions = typeof document !== 'undefined' && 'startViewTransition' in document;

    if (!supportsViewTransitions || reduceMotion || !event) {
      applyTheme(newTheme);
      return;
    }

    // Circular clip-path transition originating from click location
    const x = event.clientX;
    const y = event.clientY;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = (document as any).startViewTransition(() => {
      applyTheme(newTheme);
    });

    transition.ready.then(() => {
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`,
      ];
      document.documentElement.animate(
        {
          clipPath,
        },
        {
          duration: 450,
          easing: 'ease-in-out',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    });
  }, [applyTheme]);

  // System preference change listener
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, [theme, applyTheme]);

  // Initial sync
  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  return { theme, resolvedTheme, setTheme };
}
