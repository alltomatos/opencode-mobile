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
        <Stack.Screen name="server/[id]/index" options={{ title: 'Sessões' }} />
        <Stack.Screen name="server/[id]/new" options={{ title: 'Nova sessão', presentation: 'modal' }} />
        <Stack.Screen name="server/[id]/session/[sessionId]" options={{ title: 'Sessão' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
