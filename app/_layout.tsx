import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShadowVisible: false }}>
        <Stack.Screen name="index" options={{ title: 'Servidores' }} />
        <Stack.Screen name="pair" options={{ title: 'Parear servidor', presentation: 'modal' }} />
        <Stack.Screen name="server/[id]/index" options={{ title: 'Sessões' }} />
        <Stack.Screen name="server/[id]/session/[sessionId]" options={{ title: 'Sessão' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
