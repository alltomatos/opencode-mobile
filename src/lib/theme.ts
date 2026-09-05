import { useColorScheme } from 'react-native';

import { useSettings } from './settings';

// Paleta baseada nas cores semânticas do iOS/Apple HIG (systemBlue,
// systemGroupedBackground, label/secondaryLabel, separator etc.) —
// pedido explícito do usuário ("redesenhar com inspiração Apple").
// Mantém os mesmos nomes de token de antes (bg/surface/text/...) pra
// não precisar reescrever toda referência nas telas — só os valores
// mudaram, então a repaginação já se propaga sozinha pra tudo que usa
// useTheme(). `bg` aqui é o "systemGroupedBackground" (o cinza por
// trás das listas agrupadas), `surface` é o branco/cinza-escuro dos
// cards — esse par é a base do padrão de "grouped table view" do iOS.
const light = {
  bg: '#f2f2f7',
  bgAlt: '#e5e5ea',
  surface: '#ffffff',
  border: '#c6c6c8',
  text: '#000000',
  textDim: '#6c6c70',
  textFaint: '#aeaeb2',
  accent: '#007aff',
  accentText: '#ffffff',
  accentDim: '#b3d7ff',
  danger: '#ff3b30',
  dangerBg: '#ffe5e3',
  warnBg: '#fff7da',
  warnBorder: '#ffe59b',
  warnText: '#8a6d00',
  bubbleAssistant: '#e9e9eb',
  placeholder: '#c7c7cc',
  toolBg: '#ffffff',
  toolBorder: '#e5e5ea',
  toolShimmer: '#d1d1d6',
  success: '#34c759',
};

const dark = {
  bg: '#000000',
  bgAlt: '#1c1c1e',
  surface: '#1c1c1e',
  border: '#38383a',
  text: '#ffffff',
  textDim: '#98989f',
  textFaint: '#636366',
  accent: '#0a84ff',
  accentText: '#ffffff',
  accentDim: '#0a3d66',
  danger: '#ff453a',
  dangerBg: '#3a1614',
  warnBg: '#332b0a',
  warnBorder: '#5c4b0a',
  warnText: '#ffd335',
  bubbleAssistant: '#262629',
  placeholder: '#48484a',
  toolBg: '#1c1c1e',
  toolBorder: '#38383a',
  toolShimmer: '#3a3a3c',
  success: '#30d158',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const { settings } = useSettings();
  const resolved = settings.themeOverride === 'system' ? scheme : settings.themeOverride;
  return resolved === 'dark' ? dark : light;
}
