import { useColorScheme } from 'react-native';

import { useSettings } from './settings';

// Segue o tema do sistema em tempo real (useColorScheme já reage a
// troca ao vivo, sem precisar reiniciar o app). Nada de hex hardcoded
// nas telas — sempre consumir daqui.
const light = {
  bg: '#ffffff',
  bgAlt: '#f4f5f3',
  surface: '#ffffff',
  border: '#e5e7eb',
  text: '#111827',
  textDim: '#6b7280',
  textFaint: '#9ca3af',
  accent: '#2563eb',
  accentText: '#ffffff',
  accentDim: '#93c5fd',
  danger: '#dc2626',
  dangerBg: '#fee2e2',
  warnBg: '#fffbeb',
  warnBorder: '#fde68a',
  warnText: '#92400e',
  bubbleAssistant: '#f3f4f6',
  placeholder: '#9ca3af',
  toolBg: '#f7f7f8',
  toolBorder: '#e5e7eb',
  toolShimmer: '#c7cad1',
};

const dark = {
  bg: '#0b0f14',
  bgAlt: '#11161c',
  surface: '#161c23',
  border: '#262e37',
  text: '#eef2f6',
  textDim: '#9aa5b1',
  textFaint: '#6b7684',
  accent: '#3b82f6',
  accentText: '#ffffff',
  accentDim: '#1e3a5f',
  danger: '#f87171',
  dangerBg: '#3a1a1a',
  warnBg: '#2a2410',
  warnBorder: '#4a3d14',
  warnText: '#fbbf24',
  bubbleAssistant: '#1f262e',
  placeholder: '#6b7684',
  toolBg: '#161c23',
  toolBorder: '#262e37',
  toolShimmer: '#3a4451',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const { settings } = useSettings();
  const resolved = settings.themeOverride === 'system' ? scheme : settings.themeOverride;
  return resolved === 'dark' ? dark : light;
}
