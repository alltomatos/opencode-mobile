import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Row } from '../../../../src/components/ui/Row';
import { Section } from '../../../../src/components/ui/Section';
import { DriveRoot, listFolders, listRoots, ProjectFolder } from '../../../../src/lib/api';
import { basename, parentPath } from '../../../../src/lib/paths';
import { getServerToken, listServers, ServerConnection } from '../../../../src/lib/servers';
import { Theme, useTheme } from '../../../../src/lib/theme';

// Importar um projeto que já existe em disco (fora de PROJECTS_ROOT, ex.:
// D:\dev\algo-que-o-usuário-já-tinha) não precisa de nenhuma rota nova de
// "importação" no servidor: basta navegar até `code/<pasta>`, que já
// dispara Project.fromDirectory na primeira sessão/listagem tocando essa
// pasta (ver ProjectSessionsScreen). Esta tela é só uma árvore de
// filesystem pra achar a pasta certa — parte dos discos/raiz de verdade
// (listRoots), nunca de um caminho digitado, então funciona em qualquer
// SO sem o usuário precisar saber a sintaxe de caminho daquela máquina.
export default function ImportProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = createStyles(theme);

  const [server, setServer] = useState<ServerConnection | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [roots, setRoots] = useState<DriveRoot[] | null>(null);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<ProjectFolder[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPath, setLoadingPath] = useState<string | null>(null);
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
    listRoots(server, token)
      .then(setRoots)
      .catch(() => setRoots([]));
  }, [server, token]);

  const load = useCallback(
    (directory: string) => {
      if (!server || !token) return;
      setLoading(true);
      setLoadingPath(directory);
      setError(null);
      // Timeout generoso (não é um probe especulativo como listRoots, é
      // uma pasta que o usuário escolheu de propósito) mas com limite —
      // sem isso, um caminho que trava no servidor (ver comentário em
      // listFolders) deixava a tela "presa" sem nenhum feedback: o toque
      // mostrava o ripple e nada mais acontecia.
      listFolders(server, token, directory, { timeoutMs: 15000 })
        .then((folders) => {
          setCurrentPath(directory);
          setEntries(folders.sort((a, b) => a.name.localeCompare(b.name)));
        })
        .catch((e) => setError(e instanceof Error ? e.message : 'Não consegui abrir essa pasta.'))
        .finally(() => {
          setLoading(false);
          setLoadingPath(null);
        });
    },
    [server, token],
  );

  const parent = useMemo(() => (currentPath ? parentPath(currentPath) : null), [currentPath]);
  const currentName = currentPath ? basename(currentPath) : null;

  function importPath(path: string) {
    router.replace(`/server/${id}/code/${encodeURIComponent(path)}`);
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} contentInsetAdjustmentBehavior="automatic">
        {!currentPath && (
          <Section title="Discos" footer="Toque numa pasta pra entrar, ou no ícone de importar pra usá-la direto.">
            {roots === null && <Row title="Procurando discos…" loading />}
            {roots?.length === 0 && <Row icon="alert-circle-outline" iconColor={theme.textFaint} title="Nenhum disco encontrado" last />}
            {roots?.map((r, i) => (
              <Row
                key={r.path}
                icon="server-outline"
                iconColor={theme.textFaint}
                title={r.label}
                onPress={() => load(r.path)}
                disabled={loading}
                loading={loading && loadingPath === r.path}
                last={i === roots.length - 1}
              />
            ))}
          </Section>
        )}

        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color={theme.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {currentPath && (
          <Section title={currentName ?? currentPath}>
            <Row
              icon="arrow-up-outline"
              iconColor={theme.textFaint}
              title=".."
              subtitle={parent ?? undefined}
              onPress={() => (parent ? load(parent) : setCurrentPath(null))}
              disabled={loading}
              loading={loading && loadingPath === parent}
              accessory={loading && loadingPath === parent ? undefined : <ImportButton theme={theme} onPress={() => importPath(currentPath)} />}
            />
            {!loading && entries !== null && entries.length === 0 && (
              <Row icon="folder-outline" iconColor={theme.textFaint} title="Sem subpastas aqui" last />
            )}
            {entries?.map((entry, i) => (
              <Row
                key={entry.path}
                icon="folder-outline"
                iconColor="#5856d6"
                title={entry.name}
                onPress={() => load(entry.path)}
                disabled={loading}
                loading={loading && loadingPath === entry.path}
                last={i === entries.length - 1}
                accessory={
                  loading && loadingPath === entry.path ? undefined : (
                    <ImportButton theme={theme} onPress={() => importPath(entry.path)} />
                  )
                }
              />
            ))}
          </Section>
        )}
      </ScrollView>
    </View>
  );
}

// Botão de importar embutido na própria linha da pasta — pedido
// explícito do usuário em vez de um botão fixo só pra pasta atual, já
// que às vezes o projeto que ele quer é uma subpasta visível na lista,
// sem precisar entrar nela primeiro.
function ImportButton({ theme, onPress }: { theme: Theme; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.importButton, { backgroundColor: theme.accent, opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name="download-outline" size={14} color={theme.accentText} />
      <Text style={[styles.importButtonText, { color: theme.accentText }]}>Importar</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  importButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

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
  });
}
