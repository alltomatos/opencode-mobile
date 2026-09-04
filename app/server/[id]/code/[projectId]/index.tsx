import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createSession, listProjects, listSessions, Project, Session, subscribeEvents } from '../../../../../src/lib/api';
import { getServerToken, listServers, ServerConnection } from '../../../../../src/lib/servers';
import { Theme, useTheme } from '../../../../../src/lib/theme';

export default function ProjectSessionsScreen() {
  const { id, projectId } = useLocalSearchParams<{ id: string; projectId: string }>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = createStyles(theme);

  const [server, setServer] = useState<ServerConnection | null | undefined>(undefined);
  const [token, setToken] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null | undefined>(undefined);
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
    listProjects(server, token)
      .then((all) => setProject(all.find((p) => p.id === projectId) ?? null))
      .catch(() => setProject(null));
  }, [server, token, projectId]);

  useEffect(() => {
    if (!server || !token || !project) return;

    let cancelled = false;
    listSessions(server, token)
      .then((data) => !cancelled && setSessions(data.filter((s) => s.directory === project.worktree && !s.parentID)))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Falha ao listar sessões.'));

    const controller = new AbortController();
    (async () => {
      try {
        for await (const event of subscribeEvents(server, token, controller.signal)) {
          if (cancelled) return;
          if (event.type === 'session.created' || event.type === 'session.updated') {
            const info = (event as { properties: { info: Session } }).properties.info;
            if (info.directory !== project.worktree || info.parentID) continue;
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
  }, [server, token, project]);

  async function handleNewSession() {
    if (!server || !token || !project || creating) return;
    setCreating(true);
    setError(null);
    try {
      const session = await createSession(server, token, project.worktree);
      router.push(`/server/${id}/code/${projectId}/session/${session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao criar sessão.');
    } finally {
      setCreating(false);
    }
  }

  if (project === undefined || (project && sessions === null)) {
    return <View style={styles.container} />;
  }

  if (project === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.subtitle}>Projeto não encontrado.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.list, { paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{project.name || project.worktree.split('/').pop()}</Text>
        <Text style={styles.subtitle}>{project.worktree}</Text>
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
          <Link href={`/server/${id}/code/${projectId}/session/${item.id}`} asChild>
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
