import { useState, useEffect, useCallback } from 'react';

export type ThemeSetting = 'dark' | 'light' | 'system';
export type EffectsQuality = 'full' | 'balanced' | 'reduced';
export type MotionSetting = 'system' | 'on' | 'off';

export interface JarvisSettings {
  theme: ThemeSetting;
  effects: EffectsQuality;
  sparkles: boolean;
  backdrop: boolean;
  autoVoice: boolean;
  reducedMotion: MotionSetting;
}

const STORAGE_KEY = 'jarvis_settings';

const DEFAULT_SETTINGS: JarvisSettings = {
  theme: 'dark',
  effects: 'full',
  sparkles: true,
  backdrop: true,
  autoVoice: false,
  reducedMotion: 'system',
};

export function useSettings() {
  const [settings, setSettingsState] = useState<JarvisSettings>(() => {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch {}
    return DEFAULT_SETTINGS;
  });

  const updateSetting = useCallback(<K extends keyof JarvisSettings>(
    key: K,
    val: JarvisSettings[K]
  ) => {
    setSettingsState((prev) => {
      const next = { ...prev, [key]: val };
      // If quality is set to 'reduced', automatically sync sparkles and backdrop
      if (key === 'effects' && val === 'reduced') {
        next.sparkles = false;
        next.backdrop = false;
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // Update theme on DOM
  useEffect(() => {
    const root = document.documentElement;
    let resolved = settings.theme;
    if (resolved === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    root.setAttribute('data-theme', resolved);
    if (resolved === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  // Handle reduced motion override
  const isReducedMotion = settings.reducedMotion === 'on' ||
    (settings.reducedMotion === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  return {
    settings,
    updateSetting,
    isReducedMotion,
  };
}
