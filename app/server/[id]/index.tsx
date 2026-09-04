import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listSessions, Session, subscribeEvents } from '../../../src/lib/api';
import { getServerToken, listServers, removeServer, ServerConnection } from '../../../src/lib/servers';
import { Theme, useTheme } from '../../../src/lib/theme';

export default function ServerSessionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = createStyles(theme);
  const [server, setServer] = useState<ServerConnection | null | undefined>(undefined);
  const [token, setToken] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listServers().then(async (servers) => {
      const found = servers.find((s) => s.id === id) ?? null;
      setServer(found);
      if (found) setToken(await getServerToken(found.id));
    });
  }, [id]);

  useEffect(() => {
    if (!server || !token) return;

    let cancelled = false;
    listSessions(server, token)
      .then((data) => !cancelled && setSessions(data))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Falha ao listar sessões.'));

    // GET /event (SSE) — mantém a lista sincronizada em tempo real
    // (docs/prd/mobile-api-reference.md §5.2).
    const controller = new AbortController();
    (async () => {
      try {
        for await (const event of subscribeEvents(server, token, controller.signal)) {
          if (cancelled) return;
          if (event.type === 'session.created' || event.type === 'session.updated') {
            const info = (event as { properties: { info: Session } }).properties.info;
            setSessions((prev) => {
              const rest = (prev ?? []).filter((s) => s.id !== info.id);
              return [info, ...rest];
            });
          } else if (event.type === 'session.deleted') {
            const info = (event as { properties: { info: Session } }).properties.info;
            setSessions((prev) => (prev ?? []).filter((s) => s.id !== info.id));
          }
        }
      } catch {
        // Conexão abortada (troca de servidor/unmount) ou instável —
        // a lista continua com o último snapshot conhecido.
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [server, token]);

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
    <View style={[styles.list, { paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{server.label}</Text>
        <Text style={styles.subtitle}>{server.url}</Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {sessions === null && !error ? (
        <Text style={styles.placeholder}>Carregando sessões…</Text>
      ) : (
        <FlatList
          // Subagents (parentID definido) aparecem dentro da sessão-mãe,
          // não como item solto aqui — ver
          // docs/prd/mobile-app.md §3, item 2.
          data={(sessions ?? []).filter((s) => !s.parentID)}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.placeholder}>Nenhuma sessão ainda.</Text>}
          renderItem={({ item }) => (
            <Link href={`/server/${id}/session/${item.id}`} asChild>
              <Pressable style={styles.row}>
                <Text style={styles.rowTitle}>{item.title || item.id}</Text>
                <Text style={styles.rowMeta}>{item.directory}</Text>
              </Pressable>
            </Link>
          )}
        />
      )}

      <Link href={`/server/${id}/new`} style={styles.newLink}>
        + Nova sessão
      </Link>

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
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 12,
      backgroundColor: theme.bg,
    },
    list: {
      flex: 1,
      padding: 16,
      gap: 12,
      backgroundColor: theme.bg,
    },
    header: {
      gap: 4,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
    },
    subtitle: {
      color: theme.textDim,
    },
    error: {
      color: theme.danger,
    },
    placeholder: {
      textAlign: 'center',
      color: theme.textFaint,
      marginVertical: 24,
    },
    row: {
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    rowTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    rowMeta: {
      color: theme.textDim,
      marginTop: 2,
    },
    newLink: {
      textAlign: 'center',
      padding: 12,
      fontSize: 15,
      fontWeight: '600',
      color: theme.accent,
    },
  });
}
