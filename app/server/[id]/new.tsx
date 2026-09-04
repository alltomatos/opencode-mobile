import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { createSession, listProjects, Project } from '../../../src/lib/api';
import { getServerToken, listServers, ServerConnection } from '../../../src/lib/servers';
import { Theme, useTheme } from '../../../src/lib/theme';

// Uma "sessão" sempre vive dentro de um projeto (pasta) — não existe
// sessão solta. Esta tela lista os projetos já conhecidos pelo
// servidor (docs/prd/mobile-api-reference.md §5.4) e cria a sessão no
// projeto escolhido.
export default function NewSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const styles = createStyles(theme);

  const [server, setServer] = useState<ServerConnection | null | undefined>(undefined);
  const [token, setToken] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);

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
      .then(setProjects)
      .catch((e) => setError(e instanceof Error ? e.message : 'Falha ao listar projetos.'));
  }, [server, token]);

  async function handlePick(project: Project) {
    if (!server || !token || creatingFor) return;
    setCreatingFor(project.id);
    setError(null);
    try {
      const session = await createSession(server, token, project.worktree);
      router.replace(`/server/${id}/session/${session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao criar sessão.');
    } finally {
      setCreatingFor(null);
    }
  }

  if (!server || !projects) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.placeholder}>Nenhum projeto conhecido por este servidor ainda.</Text>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} disabled={!!creatingFor} onPress={() => handlePick(item)}>
            <Text style={styles.rowLabel}>{item.name || item.worktree.split('/').pop()}</Text>
            <Text style={styles.rowPath}>{item.worktree}</Text>
            {creatingFor === item.id && <Text style={styles.rowStatus}>Criando sessão…</Text>}
          </Pressable>
        )}
      />
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    error: {
      color: theme.danger,
      textAlign: 'center',
      padding: 12,
    },
    placeholder: {
      textAlign: 'center',
      color: theme.textFaint,
      marginTop: 32,
      paddingHorizontal: 24,
    },
    row: {
      padding: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    rowLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    rowPath: {
      color: theme.textDim,
      marginTop: 2,
      fontSize: 13,
    },
    rowStatus: {
      color: theme.accent,
      marginTop: 4,
      fontSize: 13,
    },
  });
}
