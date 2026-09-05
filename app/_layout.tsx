import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { syncNotificationChannels } from '../src/lib/notifications';
import { SettingsContext, useSettings, useSettingsState } from '../src/lib/settings';
import { useTheme } from '../src/lib/theme';

// A barra de abas (Servidores/Configurações) só existe no nível raiz —
// assim que o usuário entra num servidor específico, a navegação vira
// uma pilha cheia (sem tab bar), padrão comum em apps mobile pra dar
// mais espaço de tela ao conteúdo de trabalho (chat, sessões, etc.).
function RootNavigator() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const { settings } = useSettings();

  // Os canais de notificação do Android guardam som/vibração — refaz
  // sempre que esses toggles mudam em Configurações (a função
  // sobrescreve o canal existente, não duplica).
  useEffect(() => {
    syncNotificationChannels(settings).catch(() => {});
  }, [settings.notificationSound, settings.notificationVibration]);

  return (
    <SafeAreaProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.text,
          headerTitleStyle: { color: theme.text },
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="pair" options={{ title: 'Parear servidor', presentation: 'modal' }} />
        <Stack.Screen name="server/[id]/index" options={{ title: 'Servidor' }} />
        <Stack.Screen name="server/[id]/code/index" options={{ title: 'Projetos' }} />
        <Stack.Screen name="server/[id]/code/add" options={{ title: 'Adicionar projeto', presentation: 'modal' }} />
        <Stack.Screen name="server/[id]/code/[projectId]/index" options={{ title: 'Sessões' }} />
        <Stack.Screen name="server/[id]/code/[projectId]/session/[sessionId]" options={{ title: 'Sessão' }} />
        <Stack.Screen name="server/[id]/batuta/index" options={{ title: 'Batuta' }} />
      </Stack>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  const state = useSettingsState();
  return (
    <SettingsContext.Provider value={state}>
      <RootNavigator />
    </SettingsContext.Provider>
  );
}
