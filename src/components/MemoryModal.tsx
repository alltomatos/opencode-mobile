import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  addMemoryEntry,
  deleteProjectMemory,
  getGlobalMemoryEntries,
  getProjectMemoryEntries,
  promoteMemory,
} from '../lib/api';
import { ServerConnection } from '../lib/servers';
import { Theme, useTheme } from '../lib/theme';
import { EmptyState } from './ui/EmptyState';

type MemoryTab = 'project' | 'global';

type MemoryItem = {
  id: string;
  timestamp?: string;
  text: string;
};

function parseMemoryContent(raw: string): MemoryItem[] {
  if (!raw || !raw.trim()) return [];
  const parts = raw.split(/^##\s+/m);
  const items: MemoryItem[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;
    const firstNewline = part.indexOf('\n');
    if (firstNewline > -1) {
      const header = part.slice(0, firstNewline).trim();
      const body = part.slice(firstNewline + 1).trim();
      items.push({ id: String(i), timestamp: header, text: body });
    } else {
      items.push({ id: String(i), text: part });
    }
  }
  return items.reverse();
}

function formatMemoryDate(ts?: string): string {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

export function MemoryModal({
  visible,
  onClose,
  server,
  token,
  directory,
  projectName,
  initialTab = 'project',
  onMemoryChanged,
}: {
  visible: boolean;
  onClose: () => void;
  server: ServerConnection | null;
  token: string | null;
  directory?: string;
  projectName?: string;
  initialTab?: MemoryTab;
  onMemoryChanged?: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme);

  const hasProject = !!directory;
  const [tab, setTab] = useState<MemoryTab>(hasProject ? initialTab : 'global');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectContent, setProjectContent] = useState('');
  const [globalContent, setGlobalContent] = useState('');
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTab(hasProject ? initialTab : 'global');
    loadMemories();
  }, [visible, server, token, directory]);

  async function loadMemories() {
    if (!server || !token) return;
    setLoading(true);
    setError(null);
    try {
      if (directory) {
        const [proj, glob] = await Promise.all([
          getProjectMemoryEntries(server, token, directory).catch(() => ''),
          getGlobalMemoryEntries(server, token).catch(() => ''),
        ]);
        setProjectContent(proj);
        setGlobalContent(glob);
      } else {
        const glob = await getGlobalMemoryEntries(server, token).catch(() => '');
        setGlobalContent(glob);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar memórias.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddNote() {
    if (!server || !token || !newNote.trim() || savingNote) return;
    setSavingNote(true);
    try {
      const isGlobal = tab === 'global' || !directory;
      await addMemoryEntry(server, token, {
        directory: isGlobal ? undefined : directory,
        note: newNote.trim(),
        global: isGlobal,
      });
      setNewNote('');
      await loadMemories();
      onMemoryChanged?.();
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao salvar nota na memória.');
    } finally {
      setSavingNote(false);
    }
  }

  async function handlePromote(itemText: string) {
    if (!server || !token) return;
    Alert.alert(
      'Promover para Memória Global',
      'Essa anotação ficará disponível para todos os projetos e sessões neste servidor.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Promover',
          onPress: async () => {
            try {
              await promoteMemory(server, token, itemText);
              Alert.alert('Sucesso', 'Memória promovida para o escopo global.');
              await loadMemories();
              onMemoryChanged?.();
            } catch (err) {
              Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao promover memória.');
            }
          },
        },
      ]
    );
  }

  function confirmForgetProjectMemory() {
    if (!directory || !server || !token) return;
    Alert.alert(
      'Esquecer Memória do Projeto',
      `Deseja apagar todas as memórias salvas para "${projectName ?? 'este projeto'}"? A memória global não será afetada.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar tudo',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteProjectMemory(server, token, directory);
              setProjectContent('');
              onMemoryChanged?.();
              Alert.alert('Pronto', 'Memória do projeto apagada.');
            } catch (err) {
              Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao apagar memória.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

  const activeContent = tab === 'project' ? projectContent : globalContent;
  const items = parseMemoryContent(activeContent);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: Platform.OS === 'android' ? insets.top : 0 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="sparkles" size={22} color="#af52de" style={styles.headerIcon} />
            <View>
              <Text style={styles.title}>Memória</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {tab === 'project' ? projectName ?? 'Projeto atual' : 'Global (todos os projetos)'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={12}>
            <Ionicons name="close-circle" size={26} color={theme.textFaint} />
          </TouchableOpacity>
        </View>

        {hasProject && (
          <View style={styles.segmentedControl}>
            <TouchableOpacity
              style={[styles.segment, tab === 'project' && styles.segmentActive]}
              onPress={() => setTab('project')}
            >
              <Ionicons
                name="folder-outline"
                size={14}
                color={tab === 'project' ? theme.accent : theme.textDim}
                style={styles.segmentIcon}
              />
              <Text style={[styles.segmentText, tab === 'project' && styles.segmentTextActive]}>Projeto</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segment, tab === 'global' && styles.segmentActive]}
              onPress={() => setTab('global')}
            >
              <Ionicons
                name="globe-outline"
                size={14}
                color={tab === 'global' ? theme.accent : theme.textDim}
                style={styles.segmentIcon}
              />
              <Text style={[styles.segmentText, tab === 'global' && styles.segmentTextActive]}>Global</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={styles.loadingText}>Carregando memórias...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle-outline" size={40} color={theme.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadMemories}>
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={styles.listContainer}
            contentContainerStyle={[styles.listContent, { paddingBottom: 24 }]}
            showsVerticalScrollIndicator={false}
          >
            {items.length === 0 ? (
              <EmptyState
                icon="sparkles-outline"
                title={tab === 'project' ? 'Nenhuma memória de projeto' : 'Nenhuma memória global'}
                subtitle={
                  tab === 'project'
                    ? 'O agente registra decisões e fatos aprendidos durante as sessões deste projeto, ou você pode adicionar uma nota abaixo.'
                    : 'Fatos e preferências globais são compartilhados com todos os projetos e sessões neste servidor.'
                }
              />
            ) : (
              items.map((item) => (
                <View key={item.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.badgeRow}>
                      <Ionicons
                        name={tab === 'project' ? 'folder-outline' : 'globe-outline'}
                        size={13}
                        color={theme.textFaint}
                      />
                      <Text style={styles.cardDate}>{formatMemoryDate(item.timestamp)}</Text>
                    </View>
                    {tab === 'project' && (
                      <TouchableOpacity
                        style={styles.promoteButton}
                        onPress={() => handlePromote(item.text)}
                        hitSlop={8}
                      >
                        <Ionicons name="arrow-up-circle-outline" size={16} color={theme.accent} />
                        <Text style={styles.promoteButtonText}>Promover</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.cardText} selectable>
                    {item.text}
                  </Text>
                </View>
              ))
            )}

            {tab === 'project' && items.length > 0 && (
              <TouchableOpacity
                style={styles.forgetButton}
                onPress={confirmForgetProjectMemory}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color={theme.danger} />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={16} color={theme.danger} />
                    <Text style={styles.forgetButtonText}>Esquecer memórias deste projeto</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </ScrollView>
        )}

        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TextInput
            style={styles.input}
            placeholder={
              tab === 'project' ? 'Adicionar fato/regra ao projeto...' : 'Adicionar fato/regra global...'
            }
            placeholderTextColor={theme.placeholder}
            value={newNote}
            onChangeText={setNewNote}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!newNote.trim() || savingNote) && styles.sendButtonDisabled]}
            onPress={handleAddNote}
            disabled={!newNote.trim() || savingNote}
          >
            {savingNote ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="arrow-up" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      backgroundColor: theme.surface,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    headerIcon: {
      marginRight: 10,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.text,
    },
    subtitle: {
      fontSize: 12,
      color: theme.textDim,
      marginTop: 1,
    },
    closeButton: {
      marginLeft: 12,
    },
    segmentedControl: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 8,
      backgroundColor: theme.bgAlt,
      borderRadius: 9,
      padding: 3,
    },
    segment: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 7,
      borderRadius: 7,
    },
    segmentActive: {
      backgroundColor: theme.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.12,
      shadowRadius: 2,
      elevation: 2,
    },
    segmentIcon: {
      marginRight: 6,
    },
    segmentText: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.textDim,
    },
    segmentTextActive: {
      color: theme.text,
      fontWeight: '600',
    },
    centerContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: theme.textDim,
    },
    errorText: {
      marginTop: 10,
      fontSize: 14,
      color: theme.danger,
      textAlign: 'center',
    },
    retryButton: {
      marginTop: 16,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: theme.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    retryButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.accent,
    },
    listContainer: {
      flex: 1,
    },
    listContent: {
      padding: 16,
      gap: 12,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    cardDate: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.textFaint,
    },
    promoteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: theme.bgAlt,
    },
    promoteButtonText: {
      fontSize: 12,
      color: theme.accent,
      fontWeight: '600',
    },
    cardText: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.text,
    },
    forgetButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 12,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: theme.dangerBg,
    },
    forgetButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.danger,
    },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 16,
      paddingTop: 8,
      backgroundColor: theme.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      gap: 10,
    },
    input: {
      flex: 1,
      minHeight: 40,
      maxHeight: 100,
      backgroundColor: theme.bgAlt,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
      fontSize: 14,
      color: theme.text,
    },
    sendButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    sendButtonDisabled: {
      opacity: 0.4,
    },
  });
}
