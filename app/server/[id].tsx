import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

// Fase 1 (docs/prd/mobile-api-reference.md, seção 5.1/5.2): lista de
// sessões (GET /session) do servidor pareado `id`, com atualização em
// tempo real via SSE (GET /event).
export default function ServerSessionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sessões — servidor {id}</Text>
      <Text style={styles.subtitle}>Lista de sessões ainda não implementada.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    textAlign: 'center',
    color: '#6b7280',
  },
});
