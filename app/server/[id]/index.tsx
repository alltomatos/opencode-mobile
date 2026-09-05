import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StatusDot } from '../../../src/components/StatusDot';
import { ServerHealth } from '../../../src/lib/api';
import { getServerToken, listServers, removeServer, ServerConnection } from '../../../src/lib/servers';
import { useServerHealth } from '../../../src/lib/serverHealth';
import { Theme, useTheme } from '../../../src/lib/theme';

// `version` do servidor às vezes é literalmente a string "local"
// (build de desenvolvimento, sem número de versão de verdade) — visto
// ao vivo em GET /global/health. Mostrar "v" + isso vira "vlocal",
// confuso. Só prefixa "v" quando parece uma versão de verdade
// (começa com dígito); senão mostra o valor puro entre parênteses.
function healthLabel(health: ServerHealth | undefined): string {
  if (health === undefined) return 'Verificando…';
  if (!health.healthy) return 'Offline';
  const { version } = health;
  return /^\d/.test(version) ? `Online · v${version}` : `Online (${version})`;
}

// Servidores > [Code | Batuta] > Projetos > Sessões — este é o "hub"
// do servidor pareado.
export default function ServerHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = createStyles(theme);
  const [server, setServer] = useState<ServerConnection | null | undefined>(undefined);
  const health = useServerHealth(server ? [server] : []);

  useEffect(() => {
    listServers().then(async (servers) => {
      setServer(servers.find((s) => s.id === id) ?? null);
      // Só pra garantir que o token existe antes das telas filhas
      // precisarem dele (não usado diretamente aqui).
      await getServerToken(id!);
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
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <StatusDot health={health[server.id]} theme={theme} />
          <Text style={styles.title}>{server.label}</Text>
        </View>
        <Text style={styles.subtitle}>{server.url}</Text>
        <Text style={styles.subtitle}>{healthLabel(health[server.id])}</Text>
      </View>

      <View style={styles.cards}>
        <Link href={`/server/${id}/code`} asChild>
          <Pressable style={styles.card}>
            <Text style={styles.cardTitle}>Code</Text>
            <Text style={styles.cardSubtitle}>Projetos e sessões</Text>
          </Pressable>
        </Link>
        <Link href={`/server/${id}/batuta`} asChild>
          <Pressable style={styles.card}>
            <Text style={styles.cardTitle}>Batuta</Text>
            <Text style={styles.cardSubtitle}>Orquestração multi-agente</Text>
          </Pressable>
        </Link>
      </View>

      <Button
        title="Remover servidor"
        color={theme.danger}
        onPress={async () => {
          await removeServer(server.id);
          router.replace('/');
        }}
      />
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: 16,
      gap: 16,
      backgroundColor: theme.bg,
    },
    header: {
      gap: 4,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
    },
    subtitle: {
      color: theme.textDim,
    },
    cards: {
      flex: 1,
      gap: 12,
    },
    card: {
      padding: 20,
      borderRadius: 14,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
    },
    cardSubtitle: {
      color: theme.textDim,
      marginTop: 4,
    },
  });
}
