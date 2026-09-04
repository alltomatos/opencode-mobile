import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
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
  getSession,
  listChildren,
  listMessages,
  listPermissions,
  listQuestions,
  Message,
  MessageWithParts,
  Part,
  PermissionRequest,
  QuestionRequest,
  replyPermission,
  replyQuestion,
  sendPrompt,
  Session,
  subscribeEvents,
} from '../../../../../../src/lib/api';

// Ver docs/prd/mobile-app.md §6.1, item 3 — "modo" no app de referência
// é dois mecanismos combinados: agente (build/plan) + nível de
// auto-aceite de permissão (client-only, o servidor não tem esse
// conceito). "Aceitar edições" fica pra depois — exige diferenciar
// permissão de edição das outras só pelo campo `permission`/`patterns`.
type Mode = 'manual' | 'plan' | 'auto';
const MODE_AGENT: Record<Mode, string> = { manual: 'build', plan: 'plan', auto: 'build' };
const MODE_LABEL: Record<Mode, string> = { manual: 'Manual', plan: 'Planejar', auto: 'Automático' };
import { getServerToken, listServers, ServerConnection } from '../../../../../../src/lib/servers';
import { Theme, useTheme } from '../../../../../../src/lib/theme';

function textOf(message: MessageWithParts): string {
  return message.parts
    .filter((p): p is MessageWithParts['parts'][number] & { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

export default function SessionChatScreen() {
  const { id, projectId, sessionId } = useLocalSearchParams<{
    id: string;
    projectId: string;
    sessionId: string;
  }>();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const theme = useTheme();
  const styles = createStyles(theme);

  const [server, setServer] = useState<ServerConnection | null | undefined>(undefined);
  const [token, setToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageWithParts[] | null>(null);
  const [sessionTitle, setSessionTitle] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionQueue, setPermissionQueue] = useState<PermissionRequest[]>([]);
  const [questionQueue, setQuestionQueue] = useState<QuestionRequest[]>([]);
  const [respondingID, setRespondingID] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('manual');
  const modeRef = useRef<Mode>('manual');
  modeRef.current = mode;
  const [children, setChildren] = useState<Session[]>([]);

  useEffect(() => {
    listServers().then(async (servers) => {
      const found = servers.find((s) => s.id === id) ?? null;
      setServer(found);
      if (found) setToken(await getServerToken(found.id));
    });
  }, [id]);

  useEffect(() => {
    if (!server || !token || !sessionId) return;

    let cancelled = false;
    listMessages(server, token, sessionId)
      .then((data) => !cancelled && setMessages(data))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Falha ao carregar mensagens.'));
    getSession(server, token, sessionId)
      .then((data) => !cancelled && setSessionTitle(data.title))
      .catch(() => {});
    listPermissions(server, token)
      .then((all) => !cancelled && setPermissionQueue(all.filter((p) => p.sessionID === sessionId)))
      .catch(() => {});
    listQuestions(server, token)
      .then((all) => !cancelled && setQuestionQueue(all.filter((q) => q.sessionID === sessionId)))
      .catch(() => {});
    listChildren(server, token, sessionId)
      .then((data) => !cancelled && setChildren(data))
      .catch(() => {});

    // Enquanto o POST de envio está em voo (rota síncrona), o texto do
    // assistente chega incrementalmente por aqui via message.part.updated
    // — dá a sensação de streaming mesmo sem usar prompt_async.
    const controller = new AbortController();
    (async () => {
      try {
        for await (const event of subscribeEvents(server, token, controller.signal)) {
          if (cancelled) return;
          if (event.type === 'session.created' || event.type === 'session.updated') {
            const { sessionID, info } = (event as { properties: { sessionID: string; info: Session } })
              .properties;
            if (sessionID === sessionId) setSessionTitle(info.title);
            // Subagent (criado pela tool `task` — ver
            // docs/prd/mobile-app.md §3, item 2): parentID aponta pra
            // cá, então some/atualiza na tira de workers.
            if (info.parentID === sessionId) {
              setChildren((prev) => {
                const rest = prev.filter((c) => c.id !== info.id);
                return [...rest, info];
              });
            }
          } else if (event.type === 'message.updated') {
            const { sessionID, info } = (event as { properties: { sessionID: string; info: Message } })
              .properties;
            if (sessionID !== sessionId) continue;
            setMessages((prev) => {
              const list = prev ?? [];
              const existing = list.find((m) => m.info.id === info.id);
              if (existing) {
                return list.map((m) => (m.info.id === info.id ? { ...m, info } : m));
              }
              return [...list, { info, parts: [] }];
            });
          } else if (event.type === 'permission.asked') {
            const req = (event as { properties: PermissionRequest }).properties;
            if (req.sessionID !== sessionId) continue;
            if (modeRef.current === 'auto') {
              replyPermission(server, token, req.id, 'always').catch(() => {});
              continue;
            }
            setPermissionQueue((prev) => (prev.some((p) => p.id === req.id) ? prev : [...prev, req]));
          } else if (event.type === 'permission.replied') {
            const { requestID } = (event as { properties: { requestID: string } }).properties;
            setPermissionQueue((prev) => prev.filter((p) => p.id !== requestID));
          } else if (event.type === 'question.asked') {
            const req = (event as { properties: QuestionRequest }).properties;
            if (req.sessionID !== sessionId) continue;
            setQuestionQueue((prev) => (prev.some((q) => q.id === req.id) ? prev : [...prev, req]));
          } else if (event.type === 'question.replied' || event.type === 'question.rejected') {
            const { requestID } = (event as { properties: { requestID: string } }).properties;
            setQuestionQueue((prev) => prev.filter((q) => q.id !== requestID));
          } else if (event.type === 'message.part.updated') {
            const { sessionID, part } = (event as { properties: { sessionID: string; part: Part } }).properties;
            if (sessionID !== sessionId) continue;
            setMessages((prev) => {
              const list = prev ?? [];
              const idx = list.findIndex((m) => m.info.id === part.messageID);
              if (idx === -1) return list;
              const parts = list[idx].parts.filter((p) => p.id !== part.id);
              parts.push(part);
              const next = [...list];
              next[idx] = { ...next[idx], parts };
              return next;
            });
          }
        }
      } catch {
        // Conexão instável — a UI continua com o último estado conhecido.
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [server, token, sessionId]);

  // Flush de pedidos que já estavam na fila antes de trocar pra
  // "Automático" (ex.: carregados no GET /permission inicial).
  useEffect(() => {
    if (mode !== 'auto' || !server || !token || permissionQueue.length === 0) return;
    const toFlush = permissionQueue;
    setPermissionQueue([]);
    for (const req of toFlush) {
      replyPermission(server, token, req.id, 'always').catch(() => {});
    }
  }, [mode, server, token, permissionQueue]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || !server || !token || sending) return;

    setSending(true);
    setDraft('');
    setError(null);
    try {
      await sendPrompt(server, token, sessionId, text, MODE_AGENT[mode]);
      const [fresh, session] = await Promise.all([
        listMessages(server, token, sessionId),
        getSession(server, token, sessionId),
      ]);
      setMessages(fresh);
      setSessionTitle(session.title);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  }

  async function handlePermissionReply(req: PermissionRequest, reply: 'once' | 'always' | 'reject') {
    if (!server || !token || respondingID) return;
    setRespondingID(req.id);
    try {
      await replyPermission(server, token, req.id, reply);
      setPermissionQueue((prev) => prev.filter((p) => p.id !== req.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao responder permissão.');
    } finally {
      setRespondingID(null);
    }
  }

  // Suporta a primeira pergunta do lote com resposta única — cobre o
  // caso comum. Múltiplas perguntas ou resposta customizada por texto
  // (question.custom) ficam para quando o fluxo realmente precisar.
  async function handleQuestionAnswer(req: QuestionRequest, label: string) {
    if (!server || !token || respondingID) return;
    setRespondingID(req.id);
    try {
      await replyQuestion(server, token, req.id, [[label]]);
      setQuestionQueue((prev) => prev.filter((q) => q.id !== req.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao responder pergunta.');
    } finally {
      setRespondingID(null);
    }
  }

  const pendingPermission = permissionQueue[0];
  const pendingQuestion = questionQueue[0];
  const headerTitle = sessionTitle || 'Sessão';

  if (server === undefined || messages === null) {
    return (
      <>
        <Stack.Screen options={{ title: headerTitle }} />
        <View style={styles.container} />
      </>
    );
  }

  if (server === null) {
    return (
      <>
        <Stack.Screen options={{ title: headerTitle }} />
        <View style={styles.container}>
          <Text style={styles.placeholder}>Servidor não encontrado.</Text>
        </View>
      </>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <Stack.Screen options={{ title: headerTitle }} />

      {children.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childrenRow}>
          {children.map((child) => (
            <Link key={child.id} href={`/server/${id}/code/${projectId}/session/${child.id}`} asChild>
              <TouchableOpacity style={styles.childChip}>
                <Text style={styles.childChipLabel} numberOfLines={1}>
                  {child.title || child.id}
                </Text>
              </TouchableOpacity>
            </Link>
          ))}
        </ScrollView>
      )}

      <FlatList
        ref={listRef}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={messages}
        keyExtractor={(item) => item.info.id}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={<Text style={styles.placeholder}>Sem mensagens ainda — comece a conversa.</Text>}
        renderItem={({ item }) => {
          const text = textOf(item);
          if (!text) return null;
          const isUser = item.info.role === 'user';
          return (
            <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : undefined]}>
              <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
                <Text style={isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant}>{text}</Text>
              </View>
            </View>
          );
        }}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      {pendingPermission && (
        <View style={styles.askCard}>
          <Text style={styles.askTitle}>Permissão: {pendingPermission.permission}</Text>
          {pendingPermission.patterns.length > 0 && (
            <Text style={styles.askSubtitle}>{pendingPermission.patterns.join(', ')}</Text>
          )}
          <View style={styles.askActions}>
            <TouchableOpacity
              style={[styles.askButton, styles.askButtonReject]}
              disabled={respondingID === pendingPermission.id}
              onPress={() => handlePermissionReply(pendingPermission, 'reject')}
            >
              <Text style={styles.askButtonTextReject}>Rejeitar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.askButton}
              disabled={respondingID === pendingPermission.id}
              onPress={() => handlePermissionReply(pendingPermission, 'once')}
            >
              <Text style={styles.askButtonText}>Uma vez</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.askButton}
              disabled={respondingID === pendingPermission.id}
              onPress={() => handlePermissionReply(pendingPermission, 'always')}
            >
              <Text style={styles.askButtonText}>Sempre</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!pendingPermission && pendingQuestion && (
        <View style={styles.askCard}>
          <Text style={styles.askTitle}>{pendingQuestion.questions[0].header}</Text>
          <Text style={styles.askSubtitle}>{pendingQuestion.questions[0].question}</Text>
          <View style={styles.askOptions}>
            {pendingQuestion.questions[0].options.map((opt) => (
              <TouchableOpacity
                key={opt.label}
                style={styles.askOption}
                disabled={respondingID === pendingQuestion.id}
                onPress={() => handleQuestionAnswer(pendingQuestion, opt.label)}
              >
                <Text style={styles.askOptionLabel}>{opt.label}</Text>
                <Text style={styles.askOptionDescription}>{opt.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.modeRow}>
        {(['manual', 'plan', 'auto'] as Mode[]).map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.modeChip, mode === m && styles.modeChipActive]}
            onPress={() => setMode(m)}
          >
            <Text style={[styles.modeChipText, mode === m && styles.modeChipTextActive]}>{MODE_LABEL[m]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.composer, { paddingBottom: insets.bottom + 12 }]}>
        <TextInput
          style={styles.input}
          placeholder="Mensagem…"
          placeholderTextColor={theme.placeholder}
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, (!draft.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!draft.trim() || sending}
        >
          <Text style={styles.sendButtonText}>{sending ? '…' : 'Enviar'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    list: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    listContent: {
      padding: 16,
      gap: 8,
    },
    placeholder: {
      textAlign: 'center',
      color: theme.textFaint,
      marginTop: 24,
    },
    error: {
      color: theme.danger,
      textAlign: 'center',
      paddingVertical: 8,
    },
    bubbleRow: {
      flexDirection: 'row',
    },
    bubbleRowUser: {
      justifyContent: 'flex-end',
    },
    bubble: {
      maxWidth: '85%',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    bubbleUser: {
      backgroundColor: theme.accent,
    },
    bubbleAssistant: {
      backgroundColor: theme.bubbleAssistant,
    },
    bubbleTextUser: {
      color: theme.accentText,
      fontSize: 15,
    },
    bubbleTextAssistant: {
      color: theme.text,
      fontSize: 15,
    },
    askCard: {
      marginHorizontal: 12,
      marginBottom: 8,
      padding: 14,
      borderRadius: 12,
      backgroundColor: theme.warnBg,
      borderWidth: 1,
      borderColor: theme.warnBorder,
      gap: 8,
    },
    askTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.warnText,
    },
    askSubtitle: {
      fontSize: 13,
      color: theme.textDim,
    },
    askActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
    },
    askButton: {
      flex: 1,
      backgroundColor: theme.accent,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: 'center',
    },
    askButtonReject: {
      backgroundColor: theme.dangerBg,
    },
    askButtonText: {
      color: theme.accentText,
      fontWeight: '600',
      fontSize: 13,
    },
    askButtonTextReject: {
      color: theme.danger,
      fontWeight: '600',
      fontSize: 13,
    },
    askOptions: {
      gap: 8,
      marginTop: 4,
    },
    askOption: {
      borderWidth: 1,
      borderColor: theme.warnBorder,
      borderRadius: 10,
      padding: 10,
      backgroundColor: theme.surface,
    },
    askOptionLabel: {
      fontWeight: '600',
      fontSize: 14,
      color: theme.text,
    },
    askOptionDescription: {
      fontSize: 12,
      color: theme.textDim,
      marginTop: 2,
    },
    childrenRow: {
      flexGrow: 0,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    childChip: {
      maxWidth: 160,
      marginRight: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: theme.bgAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    childChipLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textDim,
    },
    modeRow: {
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 12,
      paddingTop: 4,
    },
    modeChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: theme.bgAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    modeChipActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    modeChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textDim,
    },
    modeChipTextActive: {
      color: theme.accentText,
    },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    input: {
      flex: 1,
      maxHeight: 120,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 15,
      color: theme.text,
    },
    sendButton: {
      backgroundColor: theme.accent,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    sendButtonDisabled: {
      backgroundColor: theme.accentDim,
    },
    sendButtonText: {
      color: theme.accentText,
      fontWeight: '600',
    },
  });
}
