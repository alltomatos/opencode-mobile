import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createSession, listSessions, Session, subscribeEvents } from '../../../../../src/lib/api';
import { getServerToken, listServers, ServerConnection } from '../../../../../src/lib/servers';
import { Theme, useTheme } from '../../../../../src/lib/theme';

export default function ProjectSessionsScreen() {
  const { id, projectId } = useLocalSearchParams<{ id: string; projectId: string }>();
  // `projectId` é o caminho absoluto da pasta, URL-encoded — não um id
  // de projeto do servidor. Ver docs/prd/mobile-app.md §5.1: listamos
  // pastas reais em vez de confiar na resolução de "projeto" do
  // servidor (frágil e não cobre pastas sem git).
  const directory = decodeURIComponent(projectId);
  const projectName = directory.split('/').pop() || directory;
  // Nunca reusar `projectId` bruto pra montar uma URL nova — não dá
  // pra saber se o React Navigation vai devolver o valor ainda
  // codificado ou já decodificado (não documentado), e `directory`
  // tem barras de verdade. Sempre recodificar a partir da fonte da
  // verdade (`directory`) evita o bug de "Unmatched Route" que
  // apareceu ao clicar Nova sessão com um projectId parcialmente
  // decodificado virando múltiplos segmentos de rota.
  const encodedProjectId = encodeURIComponent(directory);
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = createStyles(theme);

  const [server, setServer] = useState<ServerConnection | null | undefined>(undefined);
  const [token, setToken] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');

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
      .then((data) => !cancelled && setSessions(data.filter((s) => s.directory === directory && !s.parentID)))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Falha ao listar sessões.'));

    const controller = new AbortController();
    (async () => {
      try {
        for await (const event of subscribeEvents(server, token, controller.signal)) {
          if (cancelled) return;
          if (event.type === 'session.created' || event.type === 'session.updated') {
            const info = (event as { properties: { info: Session } }).properties.info;
            if (info.directory !== directory || info.parentID) continue;
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
        // Conexão instável — a lista continua com o último snapshot conhecido.
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [server, token, directory]);

  async function handleNewSession() {
    if (!server || !token || creating) return;
    setCreating(true);
    setError(null);
    try {
      const session = await createSession(server, token, directory);
      router.push(`/server/${id}/code/${encodedProjectId}/session/${session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao criar sessão.');
    } finally {
      setCreating(false);
    }
  }

  if (!server || sessions === null) {
    return <View style={styles.container} />;
  }

  return (
    <View style={[styles.list, { paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{projectName}</Text>
        <Text style={styles.subtitle}>{directory}</Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {(sessions?.length ?? 0) > 0 && (
        <TextInput
          style={styles.search}
          placeholder="Buscar sessão…"
          placeholderTextColor={theme.placeholder}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
      )}

      <FlatList
        data={(sessions ?? []).filter((s) =>
          query.trim() ? (s.title || s.id).toLowerCase().includes(query.trim().toLowerCase()) : true
        )}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.placeholder}>
            {query.trim() ? 'Nenhuma sessão bate com a busca.' : 'Nenhuma sessão ainda.'}
          </Text>
        }
        renderItem={({ item }) => (
          <Link href={`/server/${id}/code/${encodedProjectId}/session/${item.id}`} asChild>
            <Pressable style={styles.row}>
              <Text style={styles.rowTitle}>{item.title || item.id}</Text>
            </Pressable>
          </Link>
        )}
      />

      <Button title={creating ? 'Criando…' : '+ Nova sessão'} onPress={handleNewSession} disabled={creating} />
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
    search: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      color: theme.text,
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
  });
}
