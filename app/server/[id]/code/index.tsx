import { Ionicons } from '@expo/vector-icons';
import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listProjectFolders, ProjectFolder } from '../../../../src/lib/api';
import { getServerToken, listServers, ServerConnection } from '../../../../src/lib/servers';
import { Theme, useTheme } from '../../../../src/lib/theme';

export default function ProjectListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = createStyles(theme);

  const [server, setServer] = useState<ServerConnection | null | undefined>(undefined);
  const [token, setToken] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectFolder[] | null>(null);
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
    listProjectFolders(server, token)
      .then(setProjects)
      .catch((e) => setError(e instanceof Error ? e.message : 'Falha ao listar projetos.'));
  }, [server, token]);

  if (!server || projects === null) {
    return <View style={styles.container} />;
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 12 }]}>
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={theme.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {projects.length > 0 && (
        <Text style={styles.countLabel}>
          {projects.length} {projects.length === 1 ? 'projeto' : 'projetos'}
        </Text>
      )}

      <FlatList
        data={projects}
        keyExtractor={(item) => item.path}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="folder-open-outline" size={32} color={theme.textFaint} />
            </View>
            <Text style={styles.emptyTitle}>Nenhum projeto ainda</Text>
            <Text style={styles.emptySubtitle}>
              Crie uma pasta nova ou clone um repositório do GitHub pra começar.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Link href={`/server/${id}/code/${encodeURIComponent(item.path)}`} asChild>
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              android_ripple={{ color: theme.border }}
            >
              <View style={styles.rowIconWrap}>
                <Ionicons name="folder-outline" size={20} color={theme.accent} />
              </View>
              <Text style={styles.rowLabel} numberOfLines={1}>
                {item.name}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={theme.textFaint} />
            </Pressable>
          </Link>
        )}
      />

      <Link href={`/server/${id}/code/add`} asChild>
        <Pressable style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}>
          <Ionicons name="add-circle" size={20} color={theme.accentText} />
          <Text style={styles.addButtonText}>Adicionar projeto</Text>
        </Pressable>
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
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginTop: 12,
      padding: 10,
      borderRadius: 10,
      backgroundColor: theme.dangerBg,
    },
    errorText: {
      flex: 1,
      color: theme.danger,
      fontSize: 13,
    },
    countLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 4,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 8,
      gap: 8,
      flexGrow: 1,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      minHeight: 44,
    },
    rowPressed: {
      opacity: 0.7,
    },
    rowIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: theme.bgAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowLabel: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      paddingTop: 48,
      gap: 6,
    },
    emptyIconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.bgAlt,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
    },
    emptySubtitle: {
      fontSize: 13,
      color: theme.textDim,
      textAlign: 'center',
      lineHeight: 19,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginTop: 4,
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: theme.accent,
      minHeight: 44,
    },
    addButtonPressed: {
      opacity: 0.85,
    },
    addButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.accentText,
    },
  });
}
