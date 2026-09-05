import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StatusDot } from '../../../src/components/StatusDot';
import { getMemoryConfig, listProjectFolders, ServerHealth, setMemoryConfig } from '../../../src/lib/api';
import {
  describeConnection,
  getServerToken,
  listServers,
  removeServer,
  ServerConnection,
} from '../../../src/lib/servers';
import { useServerHealth } from '../../../src/lib/serverHealth';
import { Theme, useTheme } from '../../../src/lib/theme';

// `version` do servidor às vezes é literalmente a string "local"
// (build de desenvolvimento, sem número de versão de verdade) — visto
// ao vivo em GET /global/health. Mostrar "v" + isso vira "vlocal",
// confuso. Só prefixa "v" quando parece uma versão de verdade
// (começa com dígito); senão mostra o valor puro entre parênteses.
// Junto entra o tipo de conexão detectado pelo host da URL (Tailscale/
// Rede local/Internet) — pedido explícito do usuário depois de ver só
// "Online (local)" sem indicar que era via Tailscale.
function healthLabel(health: ServerHealth | undefined, connectionType: string): string {
  if (health === undefined) return 'Verificando…';
  if (!health.healthy) return 'Offline';
  const { version } = health;
  const versionLabel = /^\d/.test(version) ? `v${version}` : `(${version})`;
  return `Online · ${versionLabel} · ${connectionType}`;
}

// Servidores > [Code | Batuta] > Projetos > Sessões — este é o "hub"
// do servidor pareado.
export default function ServerHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = createStyles(theme);
  const [server, setServer] = useState<ServerConnection | null | undefined>(undefined);
  const [token, setToken] = useState<string | null>(null);
  const [memoryEnabled, setMemoryEnabled] = useState<boolean | null>(null);
  const [projectCount, setProjectCount] = useState<number | null>(null);
  const health = useServerHealth(server ? [server] : []);

  useEffect(() => {
    listServers().then(async (servers) => {
      const found = servers.find((s) => s.id === id) ?? null;
      setServer(found);
      if (found) setToken(await getServerToken(found.id));
    });
  }, [id]);

  useEffect(() => {
    if (!server || !token) return;
    listProjectFolders(server, token)
      .then((folders) => setProjectCount(folders.length))
      .catch(() => {});
  }, [server, token]);

  useEffect(() => {
    if (!server || !token) return;
    getMemoryConfig(server, token)
      .then((config) => setMemoryEnabled(config.enabled !== false))
      .catch(() => {});
  }, [server, token]);

  async function handleToggleMemory(value: boolean) {
    if (!server || !token) return;
    setMemoryEnabled(value);
    try {
      await setMemoryConfig(server, token, { enabled: value });
    } catch {
      setMemoryEnabled(!value);
    }
  }

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
        <Text style={styles.subtitle}>{healthLabel(health[server.id], describeConnection(server.url))}</Text>
      </View>

      <View style={styles.cards}>
        <Link href={`/server/${id}/code`} asChild>
          <Pressable style={styles.card}>
            <Text style={styles.cardTitle}>Code</Text>
            <Text style={styles.cardSubtitle}>
              Projetos e sessões
              {projectCount !== null
                ? ` · ${projectCount} ${projectCount === 1 ? 'projeto' : 'projetos'}`
                : ''}
            </Text>
          </Pressable>
        </Link>
        <Link href={`/server/${id}/batuta`} asChild>
          <Pressable style={styles.card}>
            <Text style={styles.cardTitle}>Batuta</Text>
            <Text style={styles.cardSubtitle}>Orquestração multi-agente</Text>
          </Pressable>
        </Link>
      </View>

      {memoryEnabled !== null && (
        <View style={styles.memoryRow}>
          <View style={styles.memoryTexts}>
            <Text style={styles.memoryTitle}>Memória (global)</Text>
            <Text style={styles.subtitle}>
              O agente guarda observações entre conversas neste servidor. Cada projeto também tem a
              própria memória (gerenciável na tela de sessões dele).
            </Text>
          </View>
          <Switch value={memoryEnabled} onValueChange={handleToggleMemory} trackColor={{ true: theme.accent }} />
        </View>
      )}

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
    memoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 14,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    memoryTexts: {
      flex: 1,
      gap: 4,
    },
    memoryTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
    },
  });
}
