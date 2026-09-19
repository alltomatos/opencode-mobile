import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BrandHeader } from '../src/components/BrandHeader';
import { initBackgroundSync } from '../src/lib/backgroundSync';
import {
  addNotificationResponseListener,
  getLastNotificationResponse,
  syncNotificationChannels,
} from '../src/lib/notifications';
import { SettingsContext, useSettings, useSettingsState } from '../src/lib/settings';
import { useTheme } from '../src/lib/theme';

// Sem tab bar NO NÍVEL DO APP: ele abre direto na lista de servidores
// (pedido explícito do usuário depois de testar uma versão com abas
// globais ali). Dentro de um servidor já pareado, porém, Code/Batuta/
// Sandbox/Configurações agora SÃO uma tab bar (grupo `(tabs)`) — pedido
// separado e mais recente do usuário, escopado a essa tela, não ao app
// inteiro; ver server/[id]/(tabs)/_layout.tsx.
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

  // Inicializa o serviço de background sync e o listener de clique em notificações
  useEffect(() => {
    initBackgroundSync().catch(() => {});

    function handleNavigate(data: {
      url?: string;
      serverId?: string;
      projectId?: string;
      sessionId?: string;
      activityId?: string;
    }) {
      if (!data) return;
      let target: string | null = null;
      if (data.serverId && data.projectId && data.sessionId) {
        const encodedProj = encodeURIComponent(decodeURIComponent(data.projectId));
        target = `/server/${data.serverId}/code/${encodedProj}/session/${data.sessionId}`;
      } else if (data.serverId && data.activityId) {
        target = `/server/${data.serverId}/batuta/${data.activityId}`;
      } else if (data.url && typeof data.url === 'string') {
        target = data.url;
      }

      if (target) {
        const route = target;
        // Atraso de 300ms para aguardar a montagem completa da árvore de rotas no Android/iOS
        setTimeout(() => {
          try {
            router.push(route as any);
          } catch {
            try {
              router.replace(route as any);
            } catch {}
          }
        }, 300);
      }
    }

    const unsubNotification = addNotificationResponseListener(handleNavigate);

    getLastNotificationResponse()
      .then((data) => {
        if (data) {
          handleNavigate(data);
        }
      })
      .catch(() => {});

    return () => {
      unsubNotification();
    };
  }, []);

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
        <Stack.Screen name="index" options={{ headerTitle: () => <BrandHeader theme={theme} /> }} />
        <Stack.Screen name="pair" options={{ title: 'Parear servidor', presentation: 'modal' }} />
        <Stack.Screen name="server/[id]/(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="server/[id]/edit" options={{ title: 'Editar servidor', presentation: 'modal' }} />
        <Stack.Screen name="server/[id]/combos" options={{ title: 'Combos de Provedores' }} />
        <Stack.Screen name="server/[id]/code/add" options={{ title: 'Adicionar projeto', presentation: 'modal' }} />
        <Stack.Screen name="server/[id]/code/import" options={{ title: 'Importar projeto', presentation: 'modal' }} />
        <Stack.Screen name="server/[id]/code/[projectId]/index" options={{ title: 'Sessões' }} />
        <Stack.Screen name="server/[id]/code/[projectId]/session/[sessionId]" options={{ title: 'Sessão' }} />
        <Stack.Screen name="server/[id]/batuta/[activityId]" options={{ title: 'Atividade' }} />
        <Stack.Screen name="server/[id]/routines/new" options={{ title: 'Nova rotina', presentation: 'modal' }} />
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
