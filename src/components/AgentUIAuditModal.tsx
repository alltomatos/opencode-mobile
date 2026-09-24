import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AgentUIAgent, AgentUIAuditEntry, getAgentUIAudit } from '../lib/api';
import { ServerConnection } from '../lib/servers';
import { Theme, useTheme } from '../lib/theme';

interface AgentUIAuditModalProps {
  visible: boolean;
  onClose: () => void;
  server: ServerConnection | null;
  token: string;
  agent: AgentUIAgent | null;
}

type ContactGroup = {
  chatKey: string;
  channel: string;
  entries: AgentUIAuditEntry[];
  lastTimestamp: number;
  lastPreview: string;
};

function groupByContact(entries: AgentUIAuditEntry[]): ContactGroup[] {
  const map = new Map<string, ContactGroup>();
  for (const entry of entries) {
    const key = `${entry.channel}\0${entry.chatKey}`;
    const existing = map.get(key);
    if (existing) {
      existing.entries.push(entry);
      if (entry.timestamp > existing.lastTimestamp) {
        existing.lastTimestamp = entry.timestamp;
        existing.lastPreview = entry.outgoing || entry.incoming;
      }
    } else {
      map.set(key, {
        chatKey: entry.chatKey,
        channel: entry.channel,
        entries: [entry],
        lastTimestamp: entry.timestamp,
        lastPreview: entry.outgoing || entry.incoming,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.lastTimestamp - a.lastTimestamp);
}

export function AgentUIAuditModal({
  visible,
  onClose,
  server,
  token,
  agent,
}: AgentUIAuditModalProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = createStyles(theme);

  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<AgentUIAuditEntry[]>([]);
  const [selectedContactKey, setSelectedContactKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !server || !token || !agent) return;
    setLoading(true);
    setError(null);
    setSelectedContactKey(null);

    getAgentUIAudit(server, token, agent.id)
      .then((data) => {
        setEntries(data ?? []);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Falha ao carregar audit log.');
      })
      .finally(() => setLoading(false));
  }, [visible, server, token, agent]);

  if (!visible) return null;

  const contacts = groupByContact(entries);
  const selectedContact = contacts.find(
    (c) => `${c.channel}\0${c.chatKey}` === selectedContactKey
  );
  const thread = [...(selectedContact?.entries ?? [])].sort((a, b) => a.timestamp - b.timestamp);

  function formatTime(ts: number): string {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + 16, height: '85%' }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.grabber} />

          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              {selectedContactKey && (
                <TouchableOpacity
                  style={styles.backBtn}
                  onPress={() => setSelectedContactKey(null)}
                  hitSlop={8}
                >
                  <Ionicons name="chevron-back" size={20} color={theme.accent} />
                </TouchableOpacity>
              )}
              <Text style={styles.title} numberOfLines={1}>
                {selectedContactKey
                  ? selectedContact?.chatKey || 'Conversa'
                  : `Audit Log: ${agent?.name || 'Agente'}`}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={8}>
              <Ionicons name="close-circle" size={24} color={theme.textFaint} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={theme.accent} />
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={40} color={theme.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : entries.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="document-text-outline" size={48} color={theme.textFaint} />
              <Text style={styles.emptyTitle}>Nenhuma mensagem auditada</Text>
              <Text style={styles.emptySubtitle}>
                As mensagens enviadas e recebidas pelos canais aparecerão aqui.
              </Text>
            </View>
          ) : !selectedContactKey ? (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {contacts.map((contact) => {
                const key = `${contact.channel}\0${contact.chatKey}`;
                const isWhatsApp = contact.channel.includes('whatsapp') || contact.channel.includes('izapia');
                const isTelegram = contact.channel.includes('telegram');

                return (
                  <TouchableOpacity
                    key={key}
                    style={styles.contactCard}
                    onPress={() => setSelectedContactKey(key)}
                  >
                    <View style={styles.contactHeader}>
                      <View style={styles.channelBadge}>
                        <Ionicons
                          name={isWhatsApp ? 'logo-whatsapp' : isTelegram ? 'paper-plane' : 'chatbubble'}
                          size={12}
                          color={isWhatsApp ? '#25D366' : isTelegram ? '#229ED9' : theme.textDim}
                        />
                        <Text style={styles.channelBadgeText}>{contact.channel}</Text>
                      </View>
                      <Text style={styles.timestamp}>{formatTime(contact.lastTimestamp)}</Text>
                    </View>

                    <Text style={styles.chatKey} numberOfLines={1}>
                      {contact.chatKey}
                    </Text>
                    <Text style={styles.preview} numberOfLines={2}>
                      {contact.lastPreview}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <ScrollView style={styles.threadScroll} contentContainerStyle={styles.threadContent}>
              {thread.map((entry) => (
                <View key={entry.id || String(entry.timestamp)} style={styles.turnBlock}>
                  {/* Mensagem do usuário */}
                  <View style={styles.userBubble}>
                    <Text style={styles.userText}>{entry.incoming}</Text>
                    <Text style={styles.bubbleMeta}>{formatTime(entry.timestamp)}</Text>
                  </View>

                  {/* Resposta do agente */}
                  <View style={styles.assistantBubble}>
                    <Text style={styles.assistantText}>{entry.outgoing}</Text>
                    <Text style={styles.bubbleMetaRight}>{formatTime(entry.timestamp)}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </Pressable>
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
      backgroundColor: theme.bg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    grabber: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.textFaint,
      alignSelf: 'center',
      marginBottom: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    headerTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
    },
    backBtn: {
      padding: 4,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      flex: 1,
    },
    closeBtn: {
      padding: 4,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 8,
    },
    errorText: {
      fontSize: 14,
      color: theme.danger,
      textAlign: 'center',
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginTop: 8,
    },
    emptySubtitle: {
      fontSize: 13,
      color: theme.textDim,
      textAlign: 'center',
      marginTop: 4,
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingVertical: 12,
      gap: 10,
    },
    contactCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      gap: 6,
    },
    contactHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    channelBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.bgAlt,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    channelBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.textDim,
    },
    timestamp: {
      fontSize: 11,
      color: theme.textFaint,
    },
    chatKey: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    preview: {
      fontSize: 13,
      color: theme.textDim,
      lineHeight: 18,
    },
    threadScroll: {
      flex: 1,
    },
    threadContent: {
      paddingVertical: 12,
      gap: 16,
    },
    turnBlock: {
      gap: 8,
    },
    userBubble: {
      alignSelf: 'flex-start',
      backgroundColor: theme.bgAlt,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      maxWidth: '85%',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    userText: {
      fontSize: 14,
      color: theme.text,
      lineHeight: 19,
    },
    assistantBubble: {
      alignSelf: 'flex-end',
      backgroundColor: theme.accent,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      maxWidth: '85%',
    },
    assistantText: {
      fontSize: 14,
      color: theme.accentText,
      lineHeight: 19,
    },
    bubbleMeta: {
      fontSize: 10,
      color: theme.textFaint,
      marginTop: 4,
    },
    bubbleMetaRight: {
      fontSize: 10,
      color: 'rgba(255,255,255,0.7)',
      marginTop: 4,
      alignSelf: 'flex-end',
    },
  });
}
