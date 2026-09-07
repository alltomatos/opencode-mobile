import { Ionicons } from '@expo/vector-icons';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Row } from '../../../../src/components/ui/Row';
import { Section } from '../../../../src/components/ui/Section';
import {
  BatutaActivity,
  BatutaActivityStatus,
  delegateBatutaActivity,
  dispatchBatutaActivity,
  listBatutaActivities,
  startBatutaActivity,
} from '../../../../src/lib/api';
import { getServerToken, listServers, ServerConnection } from '../../../../src/lib/servers';
import { Theme, useTheme } from '../../../../src/lib/theme';

const STATUS_CONFIG: Record<BatutaActivityStatus, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  pending: { label: 'Pendente', icon: 'time-outline', color: '#8E8E93' },
  in_progress: { label: 'Em Andamento', icon: 'sync-outline', color: '#007AFF' },
  completed: { label: 'Concluído', icon: 'checkmark-circle-outline', color: '#34C759' },
  failed: { label: 'Falhou', icon: 'alert-circle-outline', color: '#FF3B30' },
  canceled: { label: 'Cancelado', icon: 'close-circle-outline', color: '#FF9500' },
};

export default function BatutaActivityDetailScreen() {
  const { id, activityId } = useLocalSearchParams<{ id: string; activityId: string }>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = createStyles(theme);

  const [server, setServer] = useState<ServerConnection | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [activity, setActivity] = useState<BatutaActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listServers().then(async (list: ServerConnection[]) => {
      const found = list.find((s: ServerConnection) => s.id === id) ?? null;
      setServer(found);
      if (!found) return;
      const t = await getServerToken(found.id);
      setToken(t);
      if (!t) return;
      loadActivity(found, t);
    });
  }, [id, activityId]);

  async function loadActivity(srv: ServerConnection, tok: string) {
    setError(null);
    try {
      const list = await listBatutaActivities(srv, tok);
      const found = list.find((a: BatutaActivity) => a.id === activityId) ?? null;
      setActivity(found);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar detalhe da atividade.');
    } finally {
      setLoading(false);
    }
  }

  async function handleStart() {
    if (!server || !token || !activity) return;
    setActionInProgress('start');
    setError(null);
    try {
      await startBatutaActivity(server, token, activity.id);
      await loadActivity(server, token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao iniciar atividade.');
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleDelegate() {
    if (!server || !token || !activity) return;
    setActionInProgress('delegate');
    setError(null);
    try {
      await delegateBatutaActivity(server, token, activity.id);
      await loadActivity(server, token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao delegar atividade.');
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleDispatch() {
    if (!server || !token || !activity) return;
    setActionInProgress('dispatch');
    setError(null);
    try {
      await dispatchBatutaActivity(server, token, activity.id);
      await loadActivity(server, token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao disparar atividade.');
    } finally {
      setActionInProgress(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  if (!activity) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Atividade não encontrada.</Text>
      </View>
    );
  }

  const statusInfo = STATUS_CONFIG[activity.status] ?? STATUS_CONFIG.pending;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
    >
      <Stack.Screen options={{ title: activity.name }} />

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Section title="Informações Gerais">
        <Row title="Nome" subtitle={activity.name} />
        <Row
          title="Status"
          accessory={
            <View style={styles.statusBadge}>
              <Ionicons name={statusInfo.icon} size={14} color={statusInfo.color} style={{ marginRight: 4 }} />
              <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
            </View>
          }
        />
        {activity.branch && <Row title="Branch Git" subtitle={activity.branch} />}
        {activity.pipeline && <Row title="Pipeline" subtitle={activity.pipeline} />}
        <Row title="ID Único" subtitle={activity.id} last />
      </Section>

      <Section title="Ações de Orquestração" footer="Controle de execução e delegação orquestrador → worker.">
        <View style={styles.btnColumn}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.primaryBtn]}
            onPress={handleStart}
            disabled={actionInProgress !== null}
          >
            {actionInProgress === 'start' ? (
              <ActivityIndicator color={theme.accentText} size="small" />
            ) : (
              <>
                <Ionicons name="play-outline" size={18} color={theme.accentText} style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>Iniciar Atividade</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.secondaryBtn]}
            onPress={handleDelegate}
            disabled={actionInProgress !== null}
          >
            {actionInProgress === 'delegate' ? (
              <ActivityIndicator color={theme.accent} size="small" />
            ) : (
              <>
                <Ionicons name="git-branch-outline" size={18} color={theme.accent} style={{ marginRight: 8 }} />
                <Text style={styles.secondaryBtnText}>Delegar Orquestrador → Worker</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.secondaryBtn]}
            onPress={handleDispatch}
            disabled={actionInProgress !== null}
          >
            {actionInProgress === 'dispatch' ? (
              <ActivityIndicator color={theme.accent} size="small" />
            ) : (
              <>
                <Ionicons name="flash-outline" size={18} color={theme.accent} style={{ marginRight: 8 }} />
                <Text style={styles.secondaryBtnText}>Disparar Execução</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </Section>
    </ScrollView>
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
    errorBox: {
      padding: 12,
      borderRadius: 10,
      backgroundColor: 'rgba(255, 59, 48, 0.1)',
    },
    errorText: {
      color: theme.warnText,
      fontSize: 13,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.bgAlt,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
    },
    btnColumn: {
      padding: 12,
      gap: 10,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
    },
    primaryBtn: {
      backgroundColor: theme.accent,
    },
    primaryBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.accentText,
    },
    secondaryBtn: {
      backgroundColor: theme.bgAlt,
    },
    secondaryBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.accent,
    },
  });
}
