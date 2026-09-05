import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '../../../../src/components/ui/EmptyState';
import { Row } from '../../../../src/components/ui/Row';
import { Section } from '../../../../src/components/ui/Section';
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
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} contentInsetAdjustmentBehavior="automatic">
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color={theme.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {projects.length === 0 ? (
          <EmptyState
            icon="folder-open-outline"
            title="Nenhum projeto ainda"
            subtitle="Crie uma pasta nova ou clone um repositório do GitHub pra começar."
          />
        ) : (
          <Section title={projects.length === 1 ? '1 projeto' : `${projects.length} projetos`}>
            {projects.map((item, i) => (
              <Row
                key={item.path}
                icon="folder-outline"
                iconColor="#5856d6"
                title={item.name}
                onPress={() => router.push(`/server/${id}/code/${encodeURIComponent(item.path)}`)}
                last={i === projects.length - 1}
              />
            ))}
          </Section>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.footerCard}>
          <Row
            icon="add"
            iconColor={theme.accent}
            title="Adicionar projeto"
            onPress={() => router.push(`/server/${id}/code/add`)}
            last
          />
        </View>
      </View>
    </View>
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
      flexGrow: 1,
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 10,
      borderRadius: 10,
      backgroundColor: theme.dangerBg,
    },
    errorText: {
      flex: 1,
      color: theme.danger,
      fontSize: 13,
    },
    footer: {
      paddingHorizontal: 16,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      backgroundColor: theme.bg,
    },
    footerCard: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      overflow: 'hidden',
    },
  });
}
