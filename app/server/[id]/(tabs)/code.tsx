import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '../../../../src/components/ui/EmptyState';
import { Row } from '../../../../src/components/ui/Row';
import { Section } from '../../../../src/components/ui/Section';
import { listAllProjects, ProjectFolder } from '../../../../src/lib/api';
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
    listAllProjects(server, token)
      .then(setProjects)
      .catch((e) => setError(e instanceof Error ? e.message : 'Falha ao listar projetos.'));
  }, [server, token]);

  // Um FAB só, oferecendo os dois jeitos de trazer um projeto — pasta
  // nova ou importar uma que já existe no disco do servidor — em vez de
  // dois botões fixos no rodapé (pedido explícito do usuário, mesmo
  // padrão do FAB já usado na tela de sessões).
  function handleAddPress() {
    Alert.alert('Adicionar projeto', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Importar projeto existente', onPress: () => router.push(`/server/${id}/code/import`) },
      { text: 'Pasta nova / Clonar do GitHub', onPress: () => router.push(`/server/${id}/code/add`) },
    ]);
  }

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

      <Pressable
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={handleAddPress}
        accessibilityLabel="Adicionar projeto"
        accessibilityRole="button"
      >
        <Ionicons name="add" size={28} color={theme.accentText} />
      </Pressable>
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
      paddingBottom: 96,
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
    fab: {
      position: 'absolute',
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
  });
}
