import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StatusDot } from '../../../src/components/StatusDot';
import { Row } from '../../../src/components/ui/Row';
import { Section } from '../../../src/components/ui/Section';
import { listProjectFolders, ServerHealth } from '../../../src/lib/api';
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

// Servidores > [Code | Batuta | Configurações] — este é o "hub" do
// servidor pareado.
export default function ServerHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = createStyles(theme);
  const [server, setServer] = useState<ServerConnection | null | undefined>(undefined);
  const [token, setToken] = useState<string | null>(null);
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

  function confirmRemoveServer() {
    if (!server) return;
    Alert.alert('Remover servidor', `Isso só remove "${server.label}" da lista pareada — nada é apagado nele.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          await removeServer(server.id);
          router.replace('/');
        },
      },
    ]);
  }

  if (server === undefined) {
    return <View style={styles.container} />;
  }

  if (server === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.notFound}>Servidor não encontrado.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <StatusDot health={health[server.id]} theme={theme} />
          <Text style={styles.title}>{server.label}</Text>
        </View>
        <Text style={styles.subtitle}>{server.url}</Text>
        <Text style={styles.subtitle}>{healthLabel(health[server.id], describeConnection(server.url))}</Text>
      </View>

      <Section>
        <Row
          icon="folder-outline"
          iconColor="#5856d6"
          title="Code"
          subtitle={`Projetos e sessões${
            projectCount !== null ? ` · ${projectCount} ${projectCount === 1 ? 'projeto' : 'projetos'}` : ''
          }`}
          onPress={() => router.push(`/server/${id}/code`)}
        />
        <Row
          icon="git-network-outline"
          iconColor="#ff9500"
          title="Batuta"
          subtitle="Orquestração multi-agente"
          onPress={() => router.push(`/server/${id}/batuta`)}
        />
        <Row
          icon="settings-outline"
          iconColor={theme.textFaint}
          title="Configurações"
          subtitle="Tema, notificações, memória e mais"
          onPress={() => router.push(`/server/${id}/settings`)}
          last
        />
      </Section>

      <Section>
        <Row title="Remover servidor" destructive onPress={confirmRemoveServer} last />
      </Section>
    </ScrollView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    scroll: {
      padding: 16,
      gap: 20,
    },
    notFound: {
      padding: 16,
      color: theme.textDim,
    },
    header: {
      gap: 4,
      paddingHorizontal: 4,
      paddingBottom: 4,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.text,
    },
    subtitle: {
      fontSize: 13,
      color: theme.textDim,
    },
  });
}
