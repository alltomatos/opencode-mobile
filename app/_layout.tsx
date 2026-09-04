import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useTheme } from '../src/lib/theme';

export default function RootLayout() {
  const theme = useTheme();
  const scheme = useColorScheme();

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
        <Stack.Screen name="index" options={{ title: 'Servidores' }} />
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
