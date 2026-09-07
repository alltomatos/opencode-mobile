import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '../../../../../src/components/ui/EmptyState';
import { Row } from '../../../../../src/components/ui/Row';
import { Section } from '../../../../../src/components/ui/Section';
import {
  createSession,
  deleteProjectFolder,
  deleteProjectMemory,
  deleteSession,
  getProjectMemoryStatus,
  getSessionStatusMap,
  listSessions,
  Session,
  SessionStatus,
  subscribeEvents,
} from '../../../../../src/lib/api';
import { basename } from '../../../../../src/lib/paths';
import { getServerToken, listServers, ServerConnection } from '../../../../../src/lib/servers';
import { Theme, useTheme } from '../../../../../src/lib/theme';

export default function ProjectSessionsScreen() {
  const { id, projectId } = useLocalSearchParams<{ id: string; projectId: string }>();
  // `projectId` é o caminho absoluto da pasta, URL-encoded — não um id
  // de projeto do servidor. Ver docs/prd/mobile-app.md §5.1: listamos
  // pastas reais em vez de confiar na resolução de "projeto" do
  // servidor (frágil e não cobre pastas sem git).
  const directory = decodeURIComponent(projectId);
  const projectName = basename(directory);
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
  const [deletingProject, setDeletingProject] = useState(false);
  const [deletingSessionID, setDeletingSessionID] = useState<string | null>(null);
  const [hasMemory, setHasMemory] = useState(false);
  const [query, setQuery] = useState('');
  const [statusMap, setStatusMap] = useState<Record<string, SessionStatus>>({});

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
    listSessions(server, token, directory)
      .then((data) => !cancelled && setSessions(data.filter((s) => s.directory === directory && !s.parentID)))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Falha ao listar sessões.'));
    getProjectMemoryStatus(server, token, directory)
      .then((value) => !cancelled && setHasMemory(value))
      .catch(() => {});
    // Snapshot de quem já está rodando ANTES desta tela abrir — a partir
    // daqui os eventos SSE (session.status) mantêm isso atualizado ao
    // vivo, mas sem essa busca inicial um agente que já estava
    // trabalhando (aberto em outra aba/dispositivo) apareceria como
    // parado até o próximo evento chegar.
    getSessionStatusMap(server, token)
      .then((data) => {
        // eslint-disable-next-line no-console
        console.log('[debug] GET /session/status ->', JSON.stringify(data));
        if (!cancelled) setStatusMap(data);
      })
      .catch((e) => console.log('[debug] GET /session/status falhou:', e));

    const controller = new AbortController();
    (async () => {
      try {
        console.log('[debug] SSE conectada em', directory);
        for await (const event of subscribeEvents(server, token, controller.signal)) {
          if (cancelled) return;
          console.log('[debug] evento SSE ->', event.type);
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
            setStatusMap((prev) => {
              if (!(info.id in prev)) return prev;
              const next = { ...prev };
              delete next[info.id];
              return next;
            });
          } else if (event.type === 'session.status') {
            const { sessionID, status } = (event as { properties: { sessionID: string; status: SessionStatus } })
              .properties;
            console.log('[debug] session.status evento ->', sessionID, JSON.stringify(status));
            setStatusMap((prev) => ({ ...prev, [sessionID]: status }));
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

  function confirmDeleteSession(item: Session) {
    Alert.alert(
      'Apagar sessão',
      `Apaga "${item.title || item.id}" e todo o histórico de mensagens dela (e das sessões filhas, se houver). Não dá pra desfazer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: async () => {
            if (!server || !token) return;
            setDeletingSessionID(item.id);
            try {
              await deleteSession(server, token, item.id, directory);
              setSessions((prev) => (prev ?? []).filter((s) => s.id !== item.id));
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Falha ao apagar sessão.');
            } finally {
              setDeletingSessionID(null);
            }
          },
        },
      ]
    );
  }

  function confirmDeleteProject() {
    Alert.alert(
      'Apagar projeto',
      `Isso APAGA A PASTA DO DISCO (${directory}) e todo o histórico de sessões dela. Não dá pra desfazer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar tudo',
          style: 'destructive',
          onPress: async () => {
            if (!server || !token) return;
            setDeletingProject(true);
            setError(null);
            try {
              const ids = (sessions ?? []).map((s) => s.id);
              await deleteProjectFolder(server, token, directory, ids);
              router.replace(`/server/${id}/code`);
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Falha ao apagar projeto.');
              setDeletingProject(false);
            }
          },
        },
      ]
    );
  }

  async function forgetMemory() {
    if (!server || !token) return;
    try {
      await deleteProjectMemory(server, token, directory);
      setHasMemory(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao apagar memória do projeto.');
    }
  }

  // Um só toque no ícone já mostra o status (ativa/vazia) e, se tiver
  // algo salvo, oferece a opção de esquecer — evita um ícone extra só
  // pra "Esquecer memória" na barra compacta.
  function handleMemoryPress() {
    if (!hasMemory) {
      Alert.alert('Memória do projeto', 'Nenhuma memória guardada ainda.');
      return;
    }
    Alert.alert(
      'Memória do projeto',
      'O agente possui observações específicas salvas. A memória global não é afetada se você esquecer esta.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Esquecer memória', style: 'destructive', onPress: forgetMemory },
      ]
    );
  }

  function openSandbox() {
    let host = 'localhost';
    try {
      if (server?.url) host = new URL(server.url).hostname;
    } catch {}
    const previewUrl = `http://${host}:3000`;
    router.push(`/server/${id}/sandbox?initialUrl=${encodeURIComponent(previewUrl)}`);
  }

  if (!server || sessions === null) {
    return <View style={styles.container} />;
  }

  const filteredSessions = sessions.filter((s) =>
    query.trim() ? (s.title || s.id).toLowerCase().includes(query.trim().toLowerCase()) : true
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 148 }]}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.header}>
          <Text style={styles.title}>{projectName}</Text>
          <Text style={styles.subtitle}>{directory}</Text>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color={theme.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {sessions.length > 0 && (
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={theme.textFaint} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar sessão"
              placeholderTextColor={theme.placeholder}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
            />
          </View>
        )}

        {sessions.length === 0 ? (
          <EmptyState
            icon="chatbubbles-outline"
            title="Nenhuma sessão ainda"
            subtitle='Toque em "Nova sessão" abaixo pra começar a conversar com o agente.'
          />
        ) : filteredSessions.length === 0 ? (
          <EmptyState icon="search" title="Nada encontrado" subtitle="Nenhuma sessão bate com essa busca." />
        ) : (
          <Section>
            {filteredSessions.map((item, i) => {
              const status = statusMap[item.id];
              const busy = status?.type === 'busy' || status?.type === 'retry';
              return (
                <Row
                  key={item.id}
                  icon="chatbubble-ellipses-outline"
                  iconColor={busy ? theme.success : theme.accent}
                  title={item.title || item.id}
                  subtitle={busy ? 'Trabalhando…' : undefined}
                  onPress={() => router.push(`/server/${id}/code/${encodedProjectId}/session/${item.id}`)}
                  last={i === filteredSessions.length - 1}
                  accessory={
                    deletingSessionID === item.id ? undefined : (
                      <View style={styles.rowAccessory}>
                        {busy && <ActivityIndicator size="small" color={theme.success} />}
                        <Pressable
                          onPress={() => confirmDeleteSession(item)}
                          hitSlop={8}
                          style={styles.rowDeleteHit}
                        >
                          <Ionicons name="trash-outline" size={18} color={theme.textFaint} />
                        </Pressable>
                      </View>
                    )
                  }
                  loading={deletingSessionID === item.id}
                />
              );
            })}
          </Section>
        )}

      </ScrollView>

      {/* Fixo (não rola com a lista) — um projeto pode ter muitas
          sessões, e a barra de gerenciar precisa continuar alcançável
          sem rolar até o fim (reportado ao vivo). */}
      <View style={[styles.iconBarWrap, { paddingBottom: insets.bottom + 8 }]}>
        <Text style={styles.iconBarLabel}>GERENCIAR PROJETO</Text>
        <View style={styles.iconBar}>
          <IconMenuButton
            icon="play-circle-outline"
            color="#34c759"
            label="Sandbox"
            onPress={openSandbox}
            theme={theme}
          />
          <IconMenuButton
            icon="sparkles-outline"
            color="#af52de"
            label="Memória"
            badge={hasMemory}
            onPress={handleMemoryPress}
            theme={theme}
          />
          <View style={styles.iconBarDivider} />
          <IconMenuButton
            icon="trash-outline"
            color={theme.danger}
            label="Apagar"
            loading={deletingProject}
            onPress={confirmDeleteProject}
            theme={theme}
          />
        </View>
      </View>

      <Pressable
        style={[styles.fab, { bottom: insets.bottom + FAB_BOTTOM_OFFSET }, creating && styles.fabDisabled]}
        onPress={handleNewSession}
        disabled={creating}
        accessibilityLabel="Nova sessão"
        accessibilityRole="button"
      >
        {creating ? (
          <ActivityIndicator color={theme.accentText} />
        ) : (
          <Ionicons name="add" size={28} color={theme.accentText} />
        )}
      </Pressable>
    </View>
  );
}

// Altura aproximada da barra fixa (rótulo + botões + padding) — usada
// pra flutuar o FAB por cima dela em vez de colado no botão Apagar.
const FAB_BOTTOM_OFFSET = 116;

// Barra compacta de ícones — substitui a antiga seção "Gerenciar
// projeto" (linhas empilhadas com título+subtítulo cada) por 3 botões
// lado a lado, ícone + rótulo curto. A ação destrutiva (Apagar) fica
// separada por um divisor vertical (ui-ux-pro-max
// `destructive-nav-separation`) em vez de só mudar de cor.
function IconMenuButton({
  icon,
  color,
  label,
  badge,
  loading,
  onPress,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  badge?: boolean;
  loading?: boolean;
  onPress: () => void;
  theme: Theme;
}) {
  const styles = createIconMenuStyles(theme);
  return (
    <Pressable style={styles.button} onPress={onPress} disabled={loading} hitSlop={4}>
      <View style={[styles.iconWrap, { backgroundColor: `${color}26` }]}>
        {loading ? (
          <ActivityIndicator size="small" color={color} />
        ) : (
          <Ionicons name={icon} size={22} color={color} />
        )}
        {badge && <View style={[styles.badgeDot, { backgroundColor: color }]} />}
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function createIconMenuStyles(theme: Theme) {
  return StyleSheet.create({
    button: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
      paddingVertical: 12,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeDot: {
      position: 'absolute',
      top: -1,
      right: -1,
      width: 9,
      height: 9,
      borderRadius: 5,
      borderWidth: 2,
      borderColor: theme.surface,
    },
    label: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.textDim,
    },
  });
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
    header: {
      gap: 2,
      paddingHorizontal: 4,
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
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.bgAlt,
      borderRadius: 10,
      paddingHorizontal: 12,
      height: 36,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: theme.text,
      padding: 0,
    },
    rowAccessory: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    rowDeleteHit: {
      padding: 4,
    },
    iconBarWrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 16,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      backgroundColor: theme.bg,
    },
    iconBarLabel: {
      fontSize: 13,
      fontWeight: '400',
      color: theme.textDim,
      textTransform: 'uppercase',
      letterSpacing: 0.2,
      paddingHorizontal: 4,
      marginBottom: 7,
    },
    iconBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 14,
      paddingHorizontal: 8,
    },
    iconBarDivider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
      marginVertical: 12,
      backgroundColor: theme.border,
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
    fabDisabled: {
      opacity: 0.6,
    },
  });
}
