import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

import { listServers, removeServer, ServerConnection } from '../../src/lib/servers';

// Fase 1 (docs/prd/mobile-api-reference.md §5.1/5.2): lista de sessões
// (GET /session) do servidor pareado, com atualização em tempo real via
// SSE (GET /event) — ainda não implementado, só os metadados do servidor.
export default function ServerSessionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [server, setServer] = useState<ServerConnection | null | undefined>(undefined);

  useEffect(() => {
    listServers().then((servers) => {
      setServer(servers.find((s) => s.id === id) ?? null);
    });
  }, [id]);

  if (server === undefined) {
    return <View style={styles.container} />;
  }

  if (server === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.subtitle}>Servidor não encontrado.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{server.label}</Text>
      <Text style={styles.subtitle}>{server.url}</Text>
      <Text style={styles.placeholder}>Lista de sessões ainda não implementada.</Text>
      <Button
        title="Remover servidor"
        color="#dc2626"
        onPress={async () => {
          await removeServer(server.id);
          router.replace('/');
        }}
      />
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
  placeholder: {
    textAlign: 'center',
    color: '#9ca3af',
    marginBottom: 12,
  },
});
