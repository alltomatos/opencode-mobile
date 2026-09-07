import { Ionicons } from '@expo/vector-icons';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AppState,
  FlatList,
  Keyboard,
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
  Command,
  getSession,
  listChildren,
  listCommands,
  listMessages,
  listPermissions,
  listProviders,
  listQuestions,
  Message,
  MessageWithParts,
  Part,
  PermissionRequest,
  ProviderList,
  QuestionRequest,
  ReasoningPart,
  renameSession,
  replyPermission,
  replyQuestion,
  runCommand,
  SelectedModel,
  sendPrompt,
  sendPromptAsync,
  Session,
  SessionStatus,
  subscribeEvents,
  ToolPart,
} from '../../../../../../src/lib/api';
import {
  isHiddenPart,
  ReasoningCard,
  RetryCard,
  ThinkingRow,
  ToolCard,
} from '../../../../../../src/components/ActivityParts';
import { PromptModal } from '../../../../../../src/components/ui/PromptModal';
import { notifyAgentDone, notifyError, notifyPermissionAsked } from '../../../../../../src/lib/notifications';
import { getProjectModel, projectModelKey, setProjectModel, useSettings } from '../../../../../../src/lib/settings';

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

// Retentativa curta pra chamadas feitas uma vez só ao montar a tela.
// Sem isso, voltar do background reproduz o erro visto ao vivo
// ("fetch failed: SocketException: connection abort") — o app volta
// de minimizado antes do túnel Tailscale/rede terminar de reconectar,
// então o PRIMEIRO fetch falha por pura questão de tempo, mesmo a
// rede voltando normal um instante depois (sair e voltar da tela
// funciona só porque dá esse tempo de sobra). A SSE já reconecta
// sozinha; isso cobre o fetch inicial que não tinha esse cuidado.
async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 1000): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

// Ignora partes `synthetic` — é o corpo expandido de um comando/skill
// injetado pelo servidor, não o que o usuário digitou (ver comentário
// em TextPart, src/lib/api.ts). Igual ao desktop: quando não sobra
// nenhum texto visível (comando rodado sem argumento extra), a
// mensagem simplesmente não aparece na tela — o renderItem do
// FlatList já retorna null nesse caso, então essa função só precisa
// devolver string vazia.
function textOf(message: MessageWithParts): string {
  return message.parts
    .filter(
      (p): p is MessageWithParts['parts'][number] & { type: 'text'; text: string; synthetic?: boolean } =>
        p.type === 'text' && !(p as { synthetic?: boolean }).synthetic
    )
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
  const { settings } = useSettings();
  const directory = decodeURIComponent(projectId);
  const modelKey = projectModelKey(id, directory);

  const [server, setServer] = useState<ServerConnection | null | undefined>(undefined);
  const [token, setToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageWithParts[] | null>(null);
  const [sessionTitle, setSessionTitle] = useState<string | null>(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  // Fila de mensagens digitadas enquanto uma anterior ainda está em
  // andamento — igual ao "followup: queue" do desktop (ver
  // packages/app/src/pages/session.tsx + session-followup-queue.ts):
  // é 100% client-side, o servidor rejeita um segundo prompt na mesma
  // sessão enquanto ela está busy (Session.BusyError), então quem
  // segura a fila e dispara uma a uma é o app. Usa ref (não só state)
  // porque o loop de drenagem roda dentro de uma função async e
  // precisa ler o valor mais recente sem depender de closures presas
  // ao render em que a função foi criada.
  const queueRef = useRef<string[]>([]);
  const [queueCount, setQueueCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [permissionQueue, setPermissionQueue] = useState<PermissionRequest[]>([]);
  const [questionQueue, setQuestionQueue] = useState<QuestionRequest[]>([]);
  const [respondingID, setRespondingID] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('manual');
  const modeRef = useRef<Mode>('manual');
  modeRef.current = mode;
  // Ref porque a notificação é disparada de dentro do loop de eventos
  // SSE (useEffect com deps [server, token, sessionId]) — sem isso, o
  // toggle de Configurações mudado depois de montar a tela nunca seria
  // enxergado ali (closure presa ao valor de `settings` de quando o
  // efeito rodou pela última vez).
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [children, setChildren] = useState<Session[]>([]);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  // Com prompt_async o POST volta na hora — quem chama não sabe mais
  // quando o turno de verdade terminou (o servidor processa desacoplado
  // da conexão, ver comentário em sendPromptAsync). Só session.status
  // via SSE conta essa história: espera ver "busy" (turno começou de
  // verdade — sem isso um idle "de antes" que ainda não tinha virado
  // busy resolveria na hora, cedo demais) e depois "idle" de novo pra
  // dar como concluído. Guardado em ref porque é lido/escrito de dentro
  // do loop de eventos SSE (outro efeito) e de dispatchText.
  const turnWaiterRef = useRef<{ sawBusy: boolean; resolve: () => void } | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardVisible = keyboardHeight > 0;

  useEffect(() => {
    // No Android, o Expo Router usa react-native-screens (native
    // stack) — cada tela vive num Fragment nativo que não participa
    // do resize de janela do Android (windowSoftInputMode=resize) do
    // jeito que um app "puro" faria. KeyboardAvoidingView e
    // `behavior` não bastam aqui (testado — o composer sumia por
    // completo, não só um espaço sobrando). Solução que não depende
    // de resize nenhum: medir a altura real do teclado pelo evento e
    // empurrar o conteúdo manualmente com esse valor exato.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  const [providers, setProviders] = useState<ProviderList | null>(null);
  const [model, setModel] = useState<SelectedModel | null>(null);
  const [showModePicker, setShowModePicker] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [modelQuery, setModelQuery] = useState('');
  const [commands, setCommands] = useState<Command[]>([]);

  useEffect(() => {
    listServers().then(async (servers) => {
      const found = servers.find((s) => s.id === id) ?? null;
      setServer(found);
      if (found) setToken(await getServerToken(found.id));
    });
  }, [id]);

  useEffect(() => {
    if (!server || !token || !sessionId) return;
    // Cópias com tipo estreitado (`ServerConnection`/`string`, não
    // `| null | undefined`) pra usar dentro de funções aninhadas
    // (reconcileMessages) — o TS não propaga o narrowing do `if` acima
    // pra dentro de `function` declarada mais abaixo no mesmo escopo.
    const activeServer = server;
    const activeToken = token;

    let cancelled = false;
    // Reconcilia o histórico contra o servidor — não só uma vez ao
    // montar a tela, mas toda vez que a conexão de eventos volta
    // (reconexão da SSE) ou o app volta pro primeiro plano. Mão dupla
    // de verdade: enquanto o app fica minimizado ou a rede cai, uma
    // mensagem mandada pelo desktop/CLI (ou por outro celular) na mesma
    // sessão só chegaria aqui quando a SSE reconectasse — sem esse
    // refetch, ela ficava invisível até o usuário sair e voltar da tela
    // (reportado como bug: "histórico tem que ser via mão dupla").
    function reconcileMessages() {
      listMessages(activeServer, activeToken, sessionId)
        .then((data) => !cancelled && setMessages(data))
        .catch(() => {});
      // Um turno enviado por prompt_async pode ter começado E terminado
      // inteiro enquanto a SSE estava caída (app minimizado) — sem
      // nenhum evento busy/idle passando por aqui nesse meio tempo, quem
      // está esperando (dispatchText) travaria pra sempre. O
      // listMessages acima já traz o resultado final; libera quem
      // esperava assim que reconecta, mesmo que o turno ainda esteja
      // rodando de verdade (nesse caso raro, os eventos ao vivo que
      // vierem depois continuam atualizando `messages` normalmente).
      if (turnWaiterRef.current) {
        const waiter = turnWaiterRef.current;
        turnWaiterRef.current = null;
        waiter.resolve();
      }
    }
    withRetry(() => listMessages(server, token, sessionId))
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
    listCommands(server, token)
      .then((data) => !cancelled && setCommands(data))
      .catch(() => {});
    // Prioridade: modelo salvo pra esse projeto (setado numa sessão
    // anterior) > default do servidor. Sem isso, toda sessão nova (ou
    // voltar pra uma existente depois de sair) esquecia a escolha e
    // caía de volta no modelo padrão — reportado pelo usuário.
    Promise.all([listProviders(server, token), getProjectModel(modelKey)])
      .then(([data, saved]) => {
        if (cancelled) return;
        setProviders(data);
        setModel((prev) => {
          if (prev) return prev;
          if (saved) return saved;
          const firstConnected = data.connected[0];
          const defaultModelID = firstConnected ? data.default[firstConnected] : undefined;
          if (!firstConnected || !defaultModelID) return prev;
          return { providerID: firstConnected, modelID: defaultModelID };
        });
      })
      .catch(() => {});

    // Enquanto o POST de envio está em voo (rota síncrona), o texto do
    // assistente chega incrementalmente por aqui via message.part.updated
    // — dá a sensação de streaming mesmo sem usar prompt_async.
    const controller = new AbortController();
    let firstConnection = true;
    (async () => {
      // A conexão SSE cai sozinha de vez em quando em rede móvel/VPN
      // (visto ao vivo: "fetch failed: SocketException: connection
      // abort" bem no meio de uma resposta longa) — sem reconexão, os
      // indicadores de tool/reasoning param de atualizar e só o
      // listMessages() final no fim do handleSend mostra tudo de uma
      // vez. Continua tentando reconectar até a tela ser desmontada.
      while (!cancelled) {
        try {
          // Cada reconexão (a primeira já tem o listMessages() inicial
          // acima, então pula) reconcilia o histórico antes de voltar a
          // escutar eventos novos — cobre qualquer mensagem criada em
          // outro cliente (desktop, CLI, outro celular) durante o tempo
          // em que a SSE esteve caída.
          if (!firstConnection) reconcileMessages();
          firstConnection = false;
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
            notifyPermissionAsked(settingsRef.current, req.permission);
          } else if (event.type === 'permission.replied') {
            const { requestID } = (event as { properties: { requestID: string } }).properties;
            setPermissionQueue((prev) => prev.filter((p) => p.id !== requestID));
          } else if (event.type === 'question.asked') {
            const req = (event as { properties: QuestionRequest }).properties;
            if (req.sessionID !== sessionId) continue;
            setQuestionQueue((prev) => (prev.some((q) => q.id === req.id) ? prev : [...prev, req]));
            notifyPermissionAsked(settingsRef.current, req.questions[0]?.header ?? 'pergunta do agente');
          } else if (event.type === 'question.replied' || event.type === 'question.rejected') {
            const { requestID } = (event as { properties: { requestID: string } }).properties;
            setQuestionQueue((prev) => prev.filter((q) => q.id !== requestID));
          } else if (event.type === 'session.status') {
            const { sessionID, status } = (event as { properties: { sessionID: string; status: SessionStatus } })
              .properties;
            if (sessionID !== sessionId) continue;
            setSessionStatus(status.type === 'idle' ? null : status);
            const waiter = turnWaiterRef.current;
            if (waiter) {
              if (status.type === 'busy') waiter.sawBusy = true;
              else if (waiter.sawBusy) {
                turnWaiterRef.current = null;
                waiter.resolve();
              }
            }
          } else if (event.type === 'message.part.updated') {
            const { sessionID, part } = (event as { properties: { sessionID: string; part: Part } }).properties;
            if (sessionID !== sessionId) continue;
            setMessages((prev) => {
              const list = prev ?? [];
              const idx = list.findIndex((m) => m.info.id === part.messageID);
              if (idx === -1) {
                // A parte de tool/reasoning às vezes chega antes do
                // message.updated que cria a mensagem (visto ao vivo)
                // — cria um placeholder aqui em vez de descartar, senão
                // o card de atividade nunca aparece em tempo real.
                return [
                  ...list,
                  {
                    info: { id: part.messageID, sessionID: sessionId, role: 'assistant', time: { created: Date.now() } },
                    parts: [part],
                  },
                ];
              }
              const parts = list[idx].parts.filter((p) => p.id !== part.id);
              parts.push(part);
              const next = [...list];
              next[idx] = { ...next[idx], parts };
              return next;
            });
          }
          }
        } catch {
          // Conexão caiu — espera um pouco e tenta de novo (a menos
          // que a tela já tenha sido desmontada).
        }
        if (!cancelled) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    })();

    // O SO costuma suspender a conexão de rede (e a SSE junto) assim
    // que o app vai pro background — o listener acima só percebe isso
    // quando o `fetch` finalmente estoura, o que pode demorar. Reconcilia
    // na hora que o usuário volta a olhar a tela, sem esperar esse timeout.
    let appActive = AppState.currentState === 'active';
    const appStateSub = AppState.addEventListener('change', (state) => {
      const wasActive = appActive;
      appActive = state === 'active';
      if (appActive && !wasActive) reconcileMessages();
    });

    return () => {
      cancelled = true;
      controller.abort();
      appStateSub.remove();
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

  const commandSuggestions =
    draft.startsWith('/') && !draft.includes(' ')
      ? commands.filter((c) => c.name.toLowerCase().startsWith(draft.slice(1).toLowerCase()))
      : [];

  function enqueue(text: string) {
    queueRef.current = [...queueRef.current, text];
    setQueueCount(queueRef.current.length);
  }

  function dequeue(): string | undefined {
    const [next, ...rest] = queueRef.current;
    queueRef.current = rest;
    setQueueCount(rest.length);
    return next;
  }

  // Só a chamada de rede — sem tocar em `sending`/draft/fila, isso é
  // responsabilidade de quem chama (drainQueue), pra poder encadear
  // vários envios em sequência sem os efeitos colaterais duplicarem.
  async function dispatchCommand(name: string, args: string) {
    if (!server || !token) return;
    setError(null);
    try {
      await runCommand(server, token, sessionId, name, args);
      const fresh = await listMessages(server, token, sessionId);
      setMessages(fresh);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha ao rodar comando.';
      setError(message);
      notifyError(settings, message);
    }
  }

  async function dispatchText(text: string) {
    if (!server || !token) return;
    setError(null);
    // Eco otimista: mostra a mensagem do usuário na hora, sem esperar
    // o POST síncrono voltar. Se a rede cair no meio do caminho (visto
    // ao vivo: ConnectException/conexão instável), o texto digitado
    // não desaparece da tela — só o listMessages() do sucesso substitui
    // esse placeholder pelo dado real do servidor.
    const optimisticID = `optimistic-${Date.now()}`;
    setMessages((prev) => [
      ...(prev ?? []),
      {
        info: { id: optimisticID, sessionID: sessionId, role: 'user', time: { created: Date.now() } },
        parts: [{ id: `${optimisticID}-text`, messageID: optimisticID, type: 'text', text }],
      },
    ]);
    try {
      // prompt_async volta na hora — o turno roda no servidor
      // desacoplado desta conexão (ver comentário em sendPromptAsync),
      // então fechar o app no meio não interrompe mais o agente. Espera
      // o ciclo busy→idle via SSE (turnWaiterRef) pra saber quando o
      // turno de verdade terminou antes de puxar o histórico final e
      // liberar a próxima mensagem da fila.
      await sendPromptAsync(server, token, sessionId, text, MODE_AGENT[mode], model ?? undefined);
      await new Promise<void>((resolve) => {
        turnWaiterRef.current = { sawBusy: false, resolve };
      });
      const [fresh, session] = await Promise.all([
        listMessages(server, token, sessionId),
        getSession(server, token, sessionId),
      ]);
      setMessages(fresh);
      setSessionTitle(session.title);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha ao enviar mensagem.';
      setError(message);
      notifyError(settings, message);
    }
  }

  // "/nome args" roda via POST /session/:id/command, não como texto —
  // /model digitado como mensagem normal só faz o assistente
  // *explicar* o comando (confirmado ao testar), não executá-lo.
  async function dispatchOne(text: string) {
    if (text.startsWith('/')) {
      const [name, ...rest] = text.slice(1).split(' ');
      if (commands.some((c) => c.name === name)) {
        await dispatchCommand(name, rest.join(' '));
        return;
      }
    }
    await dispatchText(text);
  }

  // O servidor rejeita um segundo prompt na mesma sessão enquanto ela
  // está busy — só dá pra ter UM envio de verdade em voo por vez. Em
  // vez de travar o composer nesse meio tempo (o que forçava o
  // usuário a sair e voltar da tela pra "destravar", como reportado),
  // essa função vira um loop que drena a fila uma mensagem por vez,
  // igual ao Claude Code: pode digitar e mandar quantas quiser
  // enquanto a anterior ainda está rodando.
  async function drainQueue(first: string) {
    setSending(true);
    let text: string | undefined = first;
    while (text !== undefined) {
      await dispatchOne(text);
      text = dequeue();
    }
    setSending(false);
    // Só notifica quando a fila inteira esvaziou — se ainda tem
    // mensagem enfileirada, o usuário sabe que o app continua
    // trabalhando (não faz sentido notificar "terminei" no meio).
    notifyAgentDone(settings, sessionTitle ?? 'Sessão');
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text || !server || !token) return;
    setDraft('');
    if (sending) {
      enqueue(text);
      return;
    }
    await drainQueue(text);
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

  async function handleRenameSession(newTitle: string) {
    setShowRenameModal(false);
    if (!server || !token) return;
    const previous = sessionTitle;
    setSessionTitle(newTitle);
    try {
      await renameSession(server, token, sessionId, directory, newTitle);
    } catch (e) {
      setSessionTitle(previous);
      setError(e instanceof Error ? e.message : 'Falha ao renomear sessão.');
    }
  }

  const pendingPermission = permissionQueue[0];
  const pendingQuestion = questionQueue[0];
  // Rótulo do ThinkingRow: "Executando…" enquanto alguma tool está
  // rodando de verdade, senão "Pensando…" — mesma regra de
  // timeline-static-rows.tsx (hasRunningToolPart) do desktop.
  const hasRunningTool = (messages ?? []).some((m) =>
    m.parts.some((p) => p.type === 'tool' && (p as ToolPart).state.status === 'running')
  );
  const headerTitle = sessionTitle || 'Sessão';
  const selectedModelInfo = model && providers?.all.find((p) => p.id === model.providerID)?.models[model.modelID];
  const modelLabel = selectedModelInfo?.name ?? 'Modelo padrão';

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
    <View style={[styles.container, { paddingBottom: keyboardHeight }]}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <TouchableOpacity
              style={styles.headerTitleButton}
              onPress={() => setShowRenameModal(true)}
              hitSlop={8}
            >
              <Text style={styles.headerTitleText} numberOfLines={1}>
                {headerTitle}
              </Text>
              <Ionicons name="create-outline" size={15} color={theme.textFaint} />
            </TouchableOpacity>
          ),
        }}
      />

      <PromptModal
        visible={showRenameModal}
        title="Renomear sessão"
        initialValue={headerTitle}
        onCancel={() => setShowRenameModal(false)}
        onSubmit={handleRenameSession}
      />

      {children.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childrenRow}>
          {children.map((child) => (
            <Link
              key={child.id}
              // Ver comentário em code/[projectId]/index.tsx — nunca
              // reusar `projectId` bruto pra montar uma URL nova,
              // sempre decodificar+recodificar.
              href={`/server/${id}/code/${encodeURIComponent(decodeURIComponent(projectId))}/session/${child.id}`}
              asChild
            >
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
          const activityParts = item.parts.filter(
            (p: Part): p is ToolPart | ReasoningPart =>
              !isHiddenPart(p, settings.showReasoningSummaries) && (p.type === 'tool' || p.type === 'reasoning')
          );
          if (!text && activityParts.length === 0) return null;
          const isUser = item.info.role === 'user';
          return (
            <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : undefined]}>
              <View style={styles.bubbleColumn}>
                {activityParts.map((p: ToolPart | ReasoningPart) =>
                  p.type === 'reasoning' ? (
                    <ReasoningCard key={p.id} part={p} theme={theme} />
                  ) : (
                    <ToolCard key={p.id} part={p} theme={theme} defaultExpanded={settings.toolPartsExpanded} />
                  )
                )}
                {!!text && (
                  <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
                    <Text style={isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant}>{text}</Text>
                  </View>
                )}
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          sending ? (
            <View style={styles.bubbleRow}>
              <View style={styles.bubbleColumn}>
                <ThinkingRow theme={theme} executing={hasRunningTool} />
              </View>
            </View>
          ) : null
        }
      />

      {sessionStatus?.type === 'retry' && (
        <View style={styles.retryWrap}>
          <RetryCard theme={theme} attempt={sessionStatus.attempt} message={sessionStatus.message} />
        </View>
      )}

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

      {commandSuggestions.length > 0 && (
        <ScrollView style={styles.suggestions} keyboardShouldPersistTaps="handled">
          {commandSuggestions.map((c) => (
            <TouchableOpacity
              key={c.name}
              style={styles.suggestionRow}
              onPress={() => setDraft(`/${c.name} `)}
            >
              <Text style={styles.suggestionName}>/{c.name}</Text>
              {c.description && (
                <Text style={styles.suggestionDescription} numberOfLines={1}>
                  {c.description}
                </Text>
              )}
              {c.source && c.source !== 'command' && (
                <Text style={styles.suggestionSource}>{c.source}</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {queueCount > 0 && (
        <Text style={styles.queueHint}>
          {queueCount === 1 ? '1 mensagem na fila…' : `${queueCount} mensagens na fila…`}
        </Text>
      )}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Mensagem…"
          placeholderTextColor={theme.placeholder}
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        {/* Não desativa enquanto `sending` — o servidor só aceita um
            prompt em voo por sessão, mas o app enfileira o resto e
            dispara em sequência (drainQueue), então dá pra continuar
            mandando mensagem com a anterior ainda rodando, igual ao
            Claude Code. Antes disso o botão ficava travado até a
            resposta voltar, e só "destravava" se o usuário saísse e
            voltasse da tela — reportado como bug. */}
        <TouchableOpacity
          style={[styles.sendButton, !draft.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!draft.trim()}
        >
          <Text style={styles.sendButtonText}>{sending ? 'Enfileirar' : 'Enviar'}</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.dropdownRow, { paddingBottom: keyboardVisible ? 8 : insets.bottom + 8 }]}>
        <TouchableOpacity
          style={styles.dropdownChip}
          onPress={() => {
            setModelQuery('');
            setShowModelPicker(true);
          }}
        >
          <Text style={styles.dropdownChipText} numberOfLines={1}>
            {modelLabel}
          </Text>
          <Text style={styles.dropdownCaret}>▾</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dropdownChip} onPress={() => setShowModePicker(true)}>
          <Text style={styles.dropdownChipText}>{MODE_LABEL[mode]}</Text>
          <Text style={styles.dropdownCaret}>▾</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showModePicker} transparent animationType="fade" onRequestClose={() => setShowModePicker(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowModePicker(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalGrabber} />
            {(['manual', 'plan', 'auto'] as Mode[]).map((m) => (
              <TouchableOpacity
                key={m}
                style={styles.modalOption}
                onPress={() => {
                  setMode(m);
                  setShowModePicker(false);
                }}
              >
                <Text style={[styles.modalOptionText, mode === m && styles.modalOptionTextActive]}>
                  {MODE_LABEL[m]}
                </Text>
                {mode === m && <Ionicons name="checkmark" size={18} color={theme.accent} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showModelPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModelPicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={styles.modalBackdropFill} activeOpacity={1} onPress={() => setShowModelPicker(false)} />
          <View style={styles.modalSheetScroll}>
            <View style={styles.modalGrabber} />
            <View style={styles.modelSearchRow}>
              <Ionicons name="search" size={16} color={theme.textFaint} />
              <TextInput
                style={styles.modelSearchInput}
                placeholder="Buscar modelo…"
                placeholderTextColor={theme.placeholder}
                value={modelQuery}
                onChangeText={setModelQuery}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
              {modelQuery.length > 0 && (
                <TouchableOpacity onPress={() => setModelQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={theme.textFaint} />
                </TouchableOpacity>
              )}
            </View>
            <ScrollView style={styles.modelListScroll} keyboardShouldPersistTaps="handled">
              {(providers?.all ?? [])
                .filter((p) => providers?.connected.includes(p.id))
                .map((provider) => {
                  const query = modelQuery.trim().toLowerCase();
                  const models = Object.values(provider.models).filter(
                    (m) => !query || m.name.toLowerCase().includes(query) || m.id.toLowerCase().includes(query),
                  );
                  if (models.length === 0) return null;
                  return (
                    <View key={provider.id}>
                      <Text style={styles.modalGroupLabel}>{provider.name}</Text>
                      {models.map((m) => {
                        const active = model?.providerID === provider.id && model?.modelID === m.id;
                        return (
                          <TouchableOpacity
                            key={m.id}
                            style={styles.modalOption}
                            onPress={() => {
                              const next = { providerID: provider.id, modelID: m.id };
                              setModel(next);
                              setProjectModel(modelKey, next).catch(() => {});
                              setShowModelPicker(false);
                            }}
                          >
                            <Text style={[styles.modalOptionText, active && styles.modalOptionTextActive]}>
                              {m.name}
                            </Text>
                            {active && <Ionicons name="checkmark" size={18} color={theme.accent} />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })}
              {modelQuery.trim() &&
                (providers?.all ?? []).every(
                  (p) =>
                    !providers?.connected.includes(p.id) ||
                    Object.values(p.models).every(
                      (m) =>
                        !m.name.toLowerCase().includes(modelQuery.trim().toLowerCase()) &&
                        !m.id.toLowerCase().includes(modelQuery.trim().toLowerCase()),
                    ),
                ) && <Text style={styles.modelSearchEmpty}>Nenhum modelo encontrado.</Text>}
            </ScrollView>
          </View>
        </View>
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
    headerTitleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      maxWidth: 220,
    },
    headerTitleText: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.text,
      flexShrink: 1,
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
    bubbleColumn: {
      maxWidth: '85%',
      gap: 0,
    },
    retryWrap: {
      marginHorizontal: 12,
      marginBottom: 8,
    },
    queueHint: {
      textAlign: 'center',
      fontSize: 11,
      color: theme.textFaint,
      paddingBottom: 4,
    },
    bubble: {
      maxWidth: '100%',
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 9,
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
      padding: 16,
      borderRadius: 16,
      backgroundColor: theme.surface,
      gap: 8,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    askTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
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
      backgroundColor: theme.bgAlt,
      borderRadius: 12,
      paddingVertical: 11,
      alignItems: 'center',
    },
    askButtonReject: {
      backgroundColor: theme.bgAlt,
    },
    askButtonText: {
      color: theme.accent,
      fontWeight: '600',
      fontSize: 15,
    },
    askButtonTextReject: {
      color: theme.danger,
      fontWeight: '600',
      fontSize: 15,
    },
    askOptions: {
      gap: 8,
      marginTop: 4,
    },
    askOption: {
      borderRadius: 12,
      padding: 12,
      backgroundColor: theme.bgAlt,
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
    dropdownRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 8,
    },
    dropdownChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 16,
      backgroundColor: theme.bgAlt,
      maxWidth: 200,
    },
    dropdownChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.text,
    },
    dropdownCaret: {
      fontSize: 10,
      color: theme.textDim,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    modalBackdropFill: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    modalGrabber: {
      alignSelf: 'center',
      width: 36,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.border,
      marginTop: 8,
      marginBottom: 4,
    },
    modalSheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 24,
    },
    modalSheetScroll: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '60%',
    },
    modelSearchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginBottom: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: theme.bgAlt,
    },
    modelSearchInput: {
      flex: 1,
      fontSize: 15,
      color: theme.text,
      padding: 0,
    },
    modelListScroll: {
      flexShrink: 1,
    },
    modelSearchEmpty: {
      textAlign: 'center',
      color: theme.textFaint,
      fontSize: 13,
      paddingVertical: 24,
    },
    modalGroupLabel: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 6,
      fontSize: 13,
      fontWeight: '600',
      color: theme.textDim,
      textTransform: 'uppercase',
    },
    modalOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 13,
    },
    modalOptionText: {
      fontSize: 16,
      color: theme.text,
    },
    modalOptionTextActive: {
      color: theme.accent,
      fontWeight: '600',
    },
    suggestions: {
      marginHorizontal: 12,
      marginBottom: 4,
      maxHeight: 260,
      borderRadius: 10,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    suggestionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    suggestionName: {
      fontWeight: '700',
      color: theme.accent,
      fontSize: 14,
    },
    suggestionDescription: {
      flex: 1,
      color: theme.textDim,
      fontSize: 12,
    },
    suggestionSource: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.textFaint,
      textTransform: 'uppercase',
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
      minHeight: 38,
      backgroundColor: theme.bgAlt,
      borderRadius: 19,
      paddingHorizontal: 16,
      paddingVertical: 9,
      fontSize: 16,
      color: theme.text,
    },
    sendButton: {
      minHeight: 38,
      justifyContent: 'center',
      backgroundColor: theme.accent,
      borderRadius: 19,
      paddingHorizontal: 16,
    },
    sendButtonDisabled: {
      backgroundColor: theme.accentDim,
    },
    sendButtonText: {
      color: theme.accentText,
      fontWeight: '600',
      fontSize: 15,
    },
  });
}
