import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listProjects, Project } from '../../../../src/lib/api';
import { getServerToken, listServers, ServerConnection } from '../../../../src/lib/servers';
import { Theme, useTheme } from '../../../../src/lib/theme';

export default function ProjectListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = createStyles(theme);

  const [server, setServer] = useState<ServerConnection | null | undefined>(undefined);
  const [token, setToken] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
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
    listProjects(server, token)
      .then(setProjects)
      .catch((e) => setError(e instanceof Error ? e.message : 'Falha ao listar projetos.'));
  }, [server, token]);

  if (!server || projects === null) {
    return <View style={styles.container} />;
  }

  return (
    <View style={[styles.list, { paddingBottom: insets.bottom + 16 }]}>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.placeholder}>Nenhum projeto ainda — adicione um pra começar.</Text>
        }
        renderItem={({ item }) => (
          <Link href={`/server/${id}/code/${item.id}`} asChild>
            <Pressable style={styles.row}>
              <Text style={styles.rowLabel}>{item.name || item.worktree.split('/').pop()}</Text>
              <Text style={styles.rowPath}>{item.worktree}</Text>
            </Pressable>
          </Link>
        )}
      />
      <Link href={`/server/${id}/code/add`} style={styles.addLink}>
        + Adicionar projeto
      </Link>
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    list: {
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
    addLink: {
      textAlign: 'center',
      padding: 16,
      fontSize: 15,
      fontWeight: '600',
      color: theme.accent,
    },
  });
}
