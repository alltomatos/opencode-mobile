import { Ionicons } from '@expo/vector-icons';
import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '../../../../src/components/ui/EmptyState';
import { Row } from '../../../../src/components/ui/Row';
import { Section } from '../../../../src/components/ui/Section';
import {
  BatutaActivity,
  BatutaActivityStatus,
  createBatutaActivity,
  deleteBatutaActivity,
  listBatutaActivities,
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

export default function BatutaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = createStyles(theme);

  const [server, setServer] = useState<ServerConnection | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [activities, setActivities] = useState<BatutaActivity[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal de criação
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newActivityName, setNewActivityName] = useState('');
  const [newActivityPipeline, setNewActivityPipeline] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    listServers().then(async (list) => {
      const found = list.find((s) => s.id === id) ?? null;
      setServer(found);
      if (!found) return;
      const t = await getServerToken(found.id);
      setToken(t);
      if (!t) return;
      loadActivities(found, t);
    });
  }, [id]);

  async function loadActivities(srv: ServerConnection, tok: string) {
    setError(null);
    try {
      const data = await listBatutaActivities(srv, tok);
      setActivities(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar atividades do Batuta.');
    }
  }

  async function handleRefresh() {
    if (!server || !token) return;
    setRefreshing(true);
    await loadActivities(server, token);
    setRefreshing(false);
  }

  async function handleCreateActivity() {
    if (!server || !token || !newActivityName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await createBatutaActivity(server, token, {
        name: newActivityName.trim(),
        pipeline: newActivityPipeline.trim() || undefined,
      });
      setNewActivityName('');
      setNewActivityPipeline('');
      setShowCreateModal(false);
      await loadActivities(server, token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao criar atividade.');
    } finally {
      setCreating(false);
    }
  }

  function handleDeleteActivity(activity: BatutaActivity) {
    if (!server || !token) return;
    Alert.alert(
      'Remover Atividade',
      `Tem certeza que deseja apagar "${activity.name}"? Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBatutaActivity(server, token, activity.id);
              await loadActivities(server, token);
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Falha ao apagar atividade.');
            }
          },
        },
      ]
    );
  }

  if (activities === null && !error) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Batuta — Atividades</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowCreateModal(true)}
          accessibilityLabel="Criar nova atividade"
        >
          <Ionicons name="add" size={22} color={theme.accentText} />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {activities && activities.length === 0 ? (
        <EmptyState
          icon="git-network-outline"
          title="Nenhuma atividade Batuta"
          subtitle="Toque no botão + acima para criar sua primeira atividade de orquestração."
        />
      ) : (
        <FlatList
          data={activities ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.accent}
            />
          }
          renderItem={({ item }) => {
            const statusInfo = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
            return (
              <Section>
                <Link href={`/server/${id}/batuta/${item.id}`} asChild>
                  <TouchableOpacity>
                    <Row
                      title={item.name}
                      subtitle={item.pipeline ? `Pipeline: ${item.pipeline}` : `ID: ${item.id.slice(0, 8)}`}
                      accessory={
                        <View style={styles.statusBadge}>
                          <Ionicons name={statusInfo.icon} size={14} color={statusInfo.color} style={{ marginRight: 4 }} />
                          <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
                        </View>
                      }
                    />
                  </TouchableOpacity>
                </Link>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteActivity(item)}
                  >
                    <Ionicons name="trash-outline" size={16} color={theme.warnText} style={{ marginRight: 4 }} />
                    <Text style={styles.deleteButtonText}>Excluir</Text>
                  </TouchableOpacity>
                </View>
              </Section>
            );
          }}
        />
      )}

      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowCreateModal(false)}
        >
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalGrabber} />
            <Text style={styles.modalTitle}>Nova Atividade Batuta</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Nome da atividade *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Refatorar módulo de autenticação"
                placeholderTextColor={theme.placeholder}
                value={newActivityName}
                onChangeText={setNewActivityName}
                autoFocus
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Pipeline (opcional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: feature-pipeline"
                placeholderTextColor={theme.placeholder}
                value={newActivityPipeline}
                onChangeText={setNewActivityPipeline}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowCreateModal(false)}
                disabled={creating}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createBtn, !newActivityName.trim() && styles.createBtnDisabled]}
                onPress={handleCreateActivity}
                disabled={!newActivityName.trim() || creating}
              >
                {creating ? (
                  <ActivityIndicator color={theme.accentText} size="small" />
                ) : (
                  <Text style={styles.createBtnText}>Criar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
    },
    addButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorBox: {
      margin: 16,
      padding: 12,
      borderRadius: 10,
      backgroundColor: 'rgba(255, 59, 48, 0.1)',
    },
    errorText: {
      color: theme.warnText,
      fontSize: 13,
    },
    list: {
      padding: 16,
      gap: 16,
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
    actionRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    deleteButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.warnText,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 16,
      paddingBottom: 32,
      gap: 16,
    },
    modalGrabber: {
      alignSelf: 'center',
      width: 36,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.border,
      marginTop: 8,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.text,
    },
    formGroup: {
      gap: 6,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textDim,
    },
    input: {
      backgroundColor: theme.bgAlt,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 15,
      color: theme.text,
    },
    formBtnRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
      marginTop: 8,
    },
    cancelBtn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: theme.bgAlt,
    },
    cancelBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textDim,
    },
    createBtn: {
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 10,
      backgroundColor: theme.accent,
    },
    createBtnDisabled: {
      backgroundColor: theme.accentDim,
    },
    createBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.accentText,
    },
  });
}
