import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '../../../../src/components/ui/EmptyState';
import { Row } from '../../../../src/components/ui/Row';
import { Section } from '../../../../src/components/ui/Section';
import {
  deleteSchedule,
  formatActionSummary,
  formatTriggerSummary,
  listSchedules,
  runSchedule,
  Schedule,
} from '../../../../src/lib/api';
import { getServerToken, listServers, ServerConnection } from '../../../../src/lib/servers';
import { Theme, useTheme } from '../../../../src/lib/theme';

export default function RoutinesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = createStyles(theme);

  const [server, setServer] = useState<ServerConnection | null | undefined>(undefined);
  const [token, setToken] = useState<string>('');
  const [schedules, setSchedules] = useState<Schedule[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSchedules = useCallback(async (srv: ServerConnection, tok: string) => {
    try {
      const data = await listSchedules(srv, tok);
      setSchedules(data ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar rotinas.');
      setSchedules((prev) => prev ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    listServers().then(async (list) => {
      if (cancelled) return;
      const found = list.find((s) => s.id === id) ?? null;
      setServer(found);
      if (!found) {
        setLoading(false);
        return;
      }
      const t = (await getServerToken(found.id)) ?? '';
      if (cancelled) return;
      setToken(t);
      loadSchedules(found, t);
    });
    return () => {
      cancelled = true;
    };
  }, [id, loadSchedules]);

  useFocusEffect(
    useCallback(() => {
      if (server) {
        loadSchedules(server, token);
      }
    }, [server, token, loadSchedules])
  );

  async function handleRefresh() {
    if (!server) return;
    setRefreshing(true);
    await loadSchedules(server, token);
    setRefreshing(false);
  }

  async function handleRun(schedule: Schedule) {
    if (!server || runningId) return;
    setRunningId(schedule.id);
    setError(null);
    try {
      const updated = await runSchedule(server, token, schedule.id);
      setSchedules((prev) =>
        (prev ?? []).map((s) => (s.id === updated.id ? updated : s))
      );
      Alert.alert('Sucesso', 'Rotina executada.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao executar rotina.';
      setError(msg);
      Alert.alert('Erro', msg);
    } finally {
      setRunningId(null);
    }
  }

  function confirmDelete(schedule: Schedule) {
    if (!server) return;
    const triggerText = formatTriggerSummary(schedule.trigger);
    Alert.alert(
      'Remover Rotina',
      'Excluir rotina "' + triggerText + '"? Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(schedule.id);
            try {
              await deleteSchedule(server, token, schedule.id);
              setSchedules((prev) => (prev ?? []).filter((s) => s.id !== schedule.id));
            } catch (e) {
              Alert.alert('Erro', e instanceof Error ? e.message : 'Falha ao excluir rotina.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  }

  function formatLastRun(schedule: Schedule): string {
    if (!schedule.lastRunAt) return 'Nunca executada';
    const date = new Date(schedule.lastRunAt);
    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return dateStr + ' às ' + timeStr;
  }

  if (loading && schedules === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 96 }]}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
      >
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color={theme.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {schedules && schedules.length === 0 ? (
          <EmptyState
            icon="time-outline"
            title="Nenhuma rotina criada"
            subtitle="Crie rotinas para rodar comandos shell ou tarefas automatizadas com IA em horários programados."
          />
        ) : (
          <Section title={schedules?.length === 1 ? '1 rotina' : (schedules?.length ?? 0) + ' rotinas'}>
            {schedules?.map((item, i) => {
              const triggerSummary = formatTriggerSummary(item.trigger);
              const actionSummary = formatActionSummary(item.action);
              const isRunning = runningId === item.id;
              const isDeleting = deletingId === item.id;
              const isSuccess = item.lastStatus === 'success';
              const isError = item.lastStatus === 'error';

              const icon =
                item.action.kind === 'shell'
                  ? 'terminal-outline'
                  : item.action.kind === 'mcp_tool'
                  ? 'cube-outline'
                  : 'sparkles-outline';
              const iconColor =
                item.action.kind === 'shell'
                  ? '#ff9500'
                  : item.action.kind === 'mcp_tool'
                  ? theme.accent
                  : theme.purple;

              const title = item.name || triggerSummary;
              const subtitle = item.name ? `${triggerSummary} · ${actionSummary}` : actionSummary;

              return (
                <View key={item.id} style={styles.cardWrapper}>
                  <Row
                    icon={icon}
                    iconColor={iconColor}
                    title={title}
                    subtitle={subtitle}
                    last={false}
                  />

                  <View style={styles.cardFooter}>
                    <View style={styles.statusMeta}>
                      <View style={styles.statusRow}>
                        <View
                          style={[
                            styles.statusDot,
                            isSuccess && { backgroundColor: theme.emerald },
                            isError && { backgroundColor: theme.danger },
                            !item.lastStatus && { backgroundColor: theme.textFaint },
                          ]}
                        />
                        <Text style={styles.statusLabel}>
                          {isSuccess ? 'Sucesso' : isError ? 'Erro' : 'Pendente'} · {formatLastRun(item)}
                        </Text>
                      </View>
                      {item.lastError && (
                        <Text style={styles.errorSnippet} numberOfLines={1}>
                          {item.lastError}
                        </Text>
                      )}
                    </View>

                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={[styles.actionBtn, isRunning && styles.actionBtnDisabled]}
                        onPress={() => handleRun(item)}
                        disabled={isRunning || isDeleting}
                        hitSlop={6}
                      >
                        {isRunning ? (
                          <ActivityIndicator size="small" color={theme.accent} />
                        ) : (
                          <>
                            <Ionicons name="play" size={14} color={theme.accent} />
                            <Text style={styles.actionBtnText}>Rodar</Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => confirmDelete(item)}
                        disabled={isRunning || isDeleting}
                        hitSlop={6}
                      >
                        {isDeleting ? (
                          <ActivityIndicator size="small" color={theme.danger} />
                        ) : (
                          <Ionicons name="trash-outline" size={16} color={theme.danger} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  {i < (schedules?.length ?? 0) - 1 && <View style={styles.separator} />}
                </View>
              );
            })}
          </Section>
        )}
      </ScrollView>

      <Pressable
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => router.push('/server/' + id + '/routines/new')}
        accessibilityLabel="Nova rotina"
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
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
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
    cardWrapper: {
      backgroundColor: theme.surface,
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
      paddingTop: 4,
      gap: 8,
    },
    statusMeta: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    statusLabel: {
      fontSize: 12,
      color: theme.textDim,
      fontWeight: '500',
    },
    errorSnippet: {
      fontSize: 11,
      color: theme.danger,
      marginTop: 2,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: theme.bgAlt,
    },
    actionBtnDisabled: {
      opacity: 0.6,
    },
    actionBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.accent,
    },
    deleteBtn: {
      padding: 6,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
      marginHorizontal: 16,
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
