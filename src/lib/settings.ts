import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';

// Subconjunto de packages/app/src/context/settings.tsx relevante pro
// cliente mobile — a maioria de lá (showFileTree, showTerminal,
// fontSize, keybinds, sounds) não se aplica a um app sem editor/
// terminal embutido. O que sobra:
// - themeOverride: o app seguia só o tema do sistema (useColorScheme);
//   o desktop deixa escolher manualmente.
// - showReasoningSummaries: espelha o toggle homônimo do desktop
//   (default false lá — removemos o card de reasoning por causa disso).
// - toolPartsExpanded: espelha shellToolPartsExpanded/editToolPartsExpanded
//   do desktop (abrir tool cards já expandidos, sem precisar tocar).
export type ThemeOverride = 'system' | 'light' | 'dark';

export type AppSettings = {
  themeOverride: ThemeOverride;
  showReasoningSummaries: boolean;
  toolPartsExpanded: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  themeOverride: 'system',
  showReasoningSummaries: false,
  toolPartsExpanded: false,
};

const STORAGE_KEY = 'opencode-mobile:settings';

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

type SettingsContextValue = {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettingsState(): SettingsContextValue {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  function update(patch: Partial<AppSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next).catch(() => {});
      return next;
    });
  }

  return { settings, update };
}

export { SettingsContext };

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings() precisa estar dentro do <SettingsContext.Provider>.');
  return ctx;
}
