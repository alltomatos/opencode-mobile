import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme, useTheme } from '../lib/theme';
import type { Session, MessageWithParts } from '../lib/api';
import { computeSessionStats, formatDuration, formatMinutes } from '../lib/session-stats';

interface SessionStatsModalProps {
  visible: boolean;
  onClose: () => void;
  session: Session | null;
  messages: MessageWithParts[] | null;
  server: { id: string; url: string } | null;
  token: string | null;
}

interface ModelUsage {
  tokens: number;
  output: number;
  input: number;
  reasoning: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  messages: number;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

export function SessionStatsModal({ visible, onClose, session, messages, server, token }: SessionStatsModalProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = createStyles(theme);

  if (!session || !messages) {
    return null;
  }

  // Computar estatísticas da sessão atual
  const stats = computeSessionStats(session, messages);

  // Calcular porcentagens
  const totalBaseTokens = stats.inputTokens + stats.outputTokens + stats.reasoningTokens + stats.cacheReadTokens;
  const pct = (val: number) => totalBaseTokens > 0 ? Math.round((val / totalBaseTokens) * 100) : 0;

  // Top models
  const sortedModels = Object.entries(stats.modelUsage)
    .sort(([, a]: [string, ModelUsage], [, b]: [string, ModelUsage]) => b.tokens - a.tokens)
    .slice(0, 5);

  // Top tools
  const sortedTools = Object.entries(stats.toolUsage)
    .sort(([, a]: [string, number], [, b]: [string, number]) => b - a)
    .slice(0, 10);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.grabber} />
          
          <View style={styles.header}>
            <Text style={styles.title}>Estatísticas da Sessão</Text>
            <Pressable onPress={onClose} hitSlop={16}>
              <Ionicons name="close-outline" size={24} color={theme.textFaint} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {/* Tempo de Trabalho */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>⏱️ Tempo de Trabalho</Text>
              <View style={styles.kpiGrid}>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Duração Total</Text>
                  <Text style={styles.kpiValue}>{formatDuration(stats.durationMs)}</Text>
                  <Text style={styles.kpiSubtext}>{formatMinutes(stats.durationMs)}</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Início</Text>
                  <Text style={styles.kpiValue}>{new Date(session.time.created).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Última Atividade</Text>
                  <Text style={styles.kpiValue}>{new Date(session.time.updated).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</Text>
                </View>
              </View>
            </View>

            {/* Tokens */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📊 Tokens</Text>
              <View style={styles.kpiGrid}>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Total</Text>
                  <Text style={styles.kpiValue}>{formatNumber(stats.totalTokens)}</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Output</Text>
                  <Text style={[styles.kpiValue, { color: theme.purple }]}>{formatNumber(stats.outputTokens)} ({pct(stats.outputTokens)}%)</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Input</Text>
                  <Text style={[styles.kpiValue, { color: theme.blue }]}>{formatNumber(stats.inputTokens)} ({pct(stats.inputTokens)}%)</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Reasoning</Text>
                  <Text style={[styles.kpiValue, { color: theme.amber }]}>{formatNumber(stats.reasoningTokens)} ({pct(stats.reasoningTokens)}%)</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Cache</Text>
                  <Text style={[styles.kpiValue, { color: theme.emerald }]}>R: {formatNumber(stats.cacheReadTokens)} W: {formatNumber(stats.cacheWriteTokens)}</Text>
                </View>
              </View>

              {/* Barra de distribuição */}
              <View style={styles.distBarContainer}>
                <View style={styles.distBar}>
                  <View style={[styles.distSegment, { width: `${pct(stats.inputTokens)}%`, backgroundColor: theme.blue }]} />
                  <View style={[styles.distSegment, { width: `${pct(stats.outputTokens)}%`, backgroundColor: theme.purple }]} />
                  <View style={[styles.distSegment, { width: `${pct(stats.reasoningTokens)}%`, backgroundColor: theme.amber }]} />
                  <View style={[styles.distSegment, { width: `${pct(stats.cacheReadTokens)}%`, backgroundColor: theme.emerald }]} />
                </View>
                <View style={styles.distLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: theme.blue }]} />
                    <Text style={styles.legendText}>Input {pct(stats.inputTokens)}%</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: theme.purple }]} />
                    <Text style={styles.legendText}>Output {pct(stats.outputTokens)}%</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: theme.amber }]} />
                    <Text style={styles.legendText}>Reasoning {pct(stats.reasoningTokens)}%</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: theme.emerald }]} />
                    <Text style={styles.legendText}>Cache {pct(stats.cacheReadTokens)}%</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Custo */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💰 Custo</Text>
              <View style={styles.kpiGrid}>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Total</Text>
                  <Text style={[styles.kpiValue, { color: theme.rose, fontSize: 20 }]}>{formatCost(stats.totalCost)}</Text>
                </View>
              </View>
            </View>

            {/* Modelos usados */}
            {sortedModels.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🤖 Modelos</Text>
                {sortedModels.map(([modelKey, usage], index) => (
                  <View key={modelKey} style={styles.modelRow}>
                    <View style={styles.modelInfo}>
                      <Text style={styles.modelName}>{modelKey}</Text>
                      <Text style={styles.modelMeta}>
                        {formatNumber(usage.tokens)} tokens · {formatCost(usage.cost)} · {usage.messages} msgs
                      </Text>
                    </View>
                    <View style={[styles.modelBar, { width: `${Math.max(5, Math.round((usage.tokens / stats.totalTokens) * 100))}%` }]} />
                  </View>
                ))}
              </View>
            )}

            {/* Ferramentas usadas */}
            {sortedTools.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🔧 Ferramentas</Text>
                {sortedTools.map(([tool, count], index) => (
                  <View key={tool} style={styles.toolRow}>
                    <Text style={styles.toolName}>{tool}</Text>
                    <Text style={styles.toolCount}>{count}x</Text>
                    <View style={styles.toolBar}>
                      <View style={[styles.toolBarFill, { width: `${Math.max(5, Math.round((count / sortedTools[0][1])) * 100)}%` }]} />
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Info da sessão */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ℹ️ Informações</Text>
              <View style={styles.infoGrid}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>ID da Sessão</Text>
                  <Text style={styles.infoValue}>{session.id}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Agente</Text>
                  <Text style={styles.infoValue}>{session.agent || 'default'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Modelo</Text>
                  <Text style={styles.infoValue}>
                    {session.model ? `${session.model.providerID}/${session.model.id}` : 'Padrão'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Diretório</Text>
                  <Text style={styles.infoValue} numberOfLines={1}>{session.directory}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Mensagens</Text>
                  <Text style={styles.infoValue}>{messages.length}</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '85%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 10,
    },
    grabber: {
      width: 40,
      height: 5,
      backgroundColor: theme.border,
      borderRadius: 3,
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 8,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
    },
    content: {
      padding: 20,
      gap: 24,
    },
    section: {
      gap: 12,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 4,
    },
    kpiGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    kpiCard: {
      flex: 1,
      minWidth: '30%',
      backgroundColor: theme.bg,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    kpiLabel: {
      fontSize: 11,
      color: theme.textFaint,
      marginBottom: 4,
    },
    kpiValue: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    kpiSubtext: {
      fontSize: 11,
      color: theme.textFaint,
      marginTop: 2,
    },
    distBarContainer: {
      marginTop: 8,
    },
    distBar: {
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.bg,
      overflow: 'hidden',
      flexDirection: 'row',
    },
    distSegment: {
      height: '100%',
    },
    distLegend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 8,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontSize: 11,
      color: theme.textFaint,
    },
    modelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modelInfo: {
      flex: 1,
      minWidth: 0,
    },
    modelName: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.text,
    },
    modelMeta: {
      fontSize: 11,
      color: theme.textFaint,
      marginTop: 2,
    },
    modelBar: {
      height: 6,
      backgroundColor: theme.accent,
      borderRadius: 3,
      minWidth: 40,
    },
    toolRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    toolName: {
      width: 100,
      fontSize: 13,
      color: theme.text,
    },
    toolCount: {
      width: 35,
      fontSize: 13,
      fontWeight: '500',
      color: theme.accent,
      textAlign: 'right',
    },
    toolBar: {
      flex: 1,
      height: 6,
      backgroundColor: theme.bg,
      borderRadius: 3,
      overflow: 'hidden',
    },
    toolBarFill: {
      height: '100%',
      backgroundColor: theme.accent,
      borderRadius: 3,
    },
    infoGrid: {
      gap: 8,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    infoLabel: {
      fontSize: 13,
      color: theme.textFaint,
    },
    infoValue: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.text,
      textAlign: 'right',
      flex: 1,
      marginLeft: 16,
    },
  });
}