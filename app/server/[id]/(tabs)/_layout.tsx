import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { useTheme } from '../../../../src/lib/theme';

type IoniconName = keyof typeof Ionicons.glyphMap;

// Barra de navegação inferior do servidor — Code/Batuta/Sandbox/
// Configurações eram linhas empilhadas numa tela "hub" separada antes
// de entrar em qualquer uma delas (um toque a mais, e sem jeito de
// trocar de seção sem voltar). Vira abas persistentes, como em
// qualquer app nativo — pedido explícito do usuário, ver ui-ux-pro-max
// `bottom-nav-limit`/`nav-label-icon` (≤5 itens, ícone + rótulo).
// Telas mais fundas (sessão de um projeto, editar servidor, detalhe de
// atividade do Batuta) continuam como push normal por cima, escondendo
// a barra — ficam fora deste grupo, em `code/[projectId]/`, `batuta/
// [activityId].tsx` e `edit.tsx`, que o Expo Router resolve pro mesmo
// caminho de sempre por baixo dessas abas.
export default function ServerTabsLayout() {
  const theme = useTheme();

  const icon = (name: IoniconName) => ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} size={size} color={color as string} />
  );

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.text,
        headerTitleStyle: { color: theme.text },
        headerShadowVisible: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textFaint,
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border },
      }}
    >
      <Tabs.Screen name="code" options={{ title: 'Code', tabBarIcon: icon('folder-outline') }} />
      <Tabs.Screen name="batuta" options={{ title: 'Batuta', tabBarIcon: icon('git-network-outline') }} />
      <Tabs.Screen name="sandbox" options={{ title: 'Sandbox', tabBarIcon: icon('cube-outline') }} />
      <Tabs.Screen name="settings" options={{ title: 'Configurações', tabBarIcon: icon('settings-outline') }} />
    </Tabs>
  );
}
