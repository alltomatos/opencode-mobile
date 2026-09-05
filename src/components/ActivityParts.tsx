import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Part, ReasoningPart, ToolPart } from '../lib/api';
import { Theme } from '../lib/theme';

type IoniconName = keyof typeof Ionicons.glyphMap;
const AnimatedIonicon = Animated.createAnimatedComponent(Ionicons);

// Ids reais conferidos em D:\dev\opencode\packages\opencode\src\tool\*.ts
// (cada arquivo passa esse literal pro primeiro argumento de
// Tool.define) — shell.ts usa "bash", não "shell"; apply_patch.ts usa
// "apply_patch"; todo.ts usa "todowrite". Ver docs/prd/mobile-app.md.
// Ícones em SVG (Ionicons), não emoji — regra do redesign (emoji
// depende de fonte do sistema, não escala nem segue tema).
const TOOL_META: Record<string, { icon: IoniconName; label: string }> = {
  bash: { icon: 'terminal-outline', label: 'Shell' },
  read: { icon: 'document-text-outline', label: 'Lendo arquivo' },
  write: { icon: 'document-outline', label: 'Escrevendo arquivo' },
  edit: { icon: 'create-outline', label: 'Editando arquivo' },
  apply_patch: { icon: 'construct-outline', label: 'Aplicando patch' },
  glob: { icon: 'search-outline', label: 'Buscando arquivos' },
  grep: { icon: 'search-outline', label: 'Buscando texto' },
  webfetch: { icon: 'globe-outline', label: 'Buscando página' },
  websearch: { icon: 'globe-outline', label: 'Pesquisando na web' },
  task: { icon: 'git-network-outline', label: 'Subagente' },
  skill: { icon: 'sparkles-outline', label: 'Skill' },
  question: { icon: 'help-circle-outline', label: 'Pergunta' },
  memory_search: { icon: 'sparkles-outline', label: 'Buscando na memória' },
  memory_save: { icon: 'save-outline', label: 'Salvando na memória' },
  lsp: { icon: 'code-slash-outline', label: 'LSP' },
  plan_exit: { icon: 'list-outline', label: 'Plano' },
  browser: { icon: 'desktop-outline', label: 'Navegador' },
  computer: { icon: 'desktop-outline', label: 'Computador' },
};

// Partes que o desktop não mostra na timeline (session-ui/message-part.tsx
// HIDDEN_TOOLS + step-start/step-finish são só marcadores de agrupamento).
// `reasoning` some por padrão também — conferido em
// packages/app/src/context/settings.tsx: showReasoningSummaries começa
// `false` lá. Aqui isso virou um toggle em Configurações
// (settings.showReasoningSummaries), não uma regra fixa — por isso
// recebe o valor do toggle em vez de decidir sozinho.
export function isHiddenPart(part: Part, showReasoningSummaries: boolean): boolean {
  if (part.type === 'step-start' || part.type === 'step-finish') return true;
  if (part.type === 'reasoning' && !showReasoningSummaries) return true;
  if (part.type === 'tool' && (part as ToolPart).tool === 'todowrite') return true;
  return false;
}

function useShimmer(active: boolean) {
  const value = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) {
      value.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 0.35, duration: 700, easing: Easing.ease, useNativeDriver: true }),
        Animated.timing(value, { toValue: 1, duration: 700, easing: Easing.ease, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, value]);
  return value;
}

// Anima a opacidade de um View em volta (não do próprio Text) —
// animar Animated.Text direto com numberOfLines mostrou o texto
// invisível em teste real (Android/Hermes), então evita a composição
// arriscada e usa um <Text> normal dentro de um Animated.View.
//
// `flexShrink: 1` sem `flex`/`flexGrow` — `flex: 1` vira flexGrow:1 +
// flexBasis:0%, e dentro de um container que se ajusta ao próprio
// conteúdo (o balão do card quando não tem mais nada ao lado, ex.: o
// ThinkingRow sozinho no rodapé da lista) essa base zero nunca cresce
// (não tem "espaço sobrando" a distribuir num pai sem largura fixa) —
// resultado: o texto colapsa pra largura zero e some. Visto ao vivo:
// o ícone aparecia, a palavra do lado não.
function ShimmerLabel({ text, active, style }: { text: string; active: boolean; style: object }) {
  const opacity = useShimmer(active);
  return (
    <Animated.View style={[{ flexShrink: 1 }, active ? { opacity } : undefined]}>
      <Text style={style} numberOfLines={1}>
        {text || ' '}
      </Text>
    </Animated.View>
  );
}

function usePulse(active: boolean) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      value.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, value]);
  return value;
}

// Ícone com leve "respiração" (escala) enquanto ativo — dá a pista
// visual de "acontecendo agora" além do shimmer do texto.
function AnimatedIcon({ icon, color, active }: { icon: IoniconName; color: string; active: boolean }) {
  const pulse = usePulse(active);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] });
  return (
    <AnimatedIonicon
      name={icon}
      size={16}
      color={color}
      style={active ? { transform: [{ scale }] } : undefined}
    />
  );
}

// Card de tool: colapsado por padrão, expande só quando concluído (ou
// com erro) — igual ao BasicTool do desktop (session-ui/basic-tool.tsx).
// `skill` nunca expande (hideDetails no desktop): só a linha shimmer.
export function ToolCard({
  part,
  theme,
  defaultExpanded = false,
}: {
  part: ToolPart;
  theme: Theme;
  defaultExpanded?: boolean;
}) {
  const [open, setOpen] = useState(defaultExpanded);
  const meta = TOOL_META[part.tool] ?? { icon: 'construct-outline' as IoniconName, label: part.tool || 'Ferramenta' };
  const isPending = part.state.status === 'pending' || part.state.status === 'running';
  const isError = part.state.status === 'error';
  const hideDetails = part.tool === 'skill';
  const title = (part.state as { title?: string }).title || meta.label;
  const styles = createCardStyles(theme, isError);
  const iconColor = isError ? theme.danger : theme.textDim;

  const body = isError ? part.state.error : part.state.output;
  const canExpand = !hideDetails && !isPending && !!body;

  return (
    <TouchableOpacity
      activeOpacity={canExpand ? 0.7 : 1}
      disabled={!canExpand}
      onPress={() => setOpen((o) => !o)}
      style={styles.card}
    >
      <View style={styles.row}>
        <AnimatedIcon icon={meta.icon} color={iconColor} active={isPending} />
        <ShimmerLabel text={isPending ? `${title}…` : title} active={isPending} style={styles.title} />
        {canExpand && (
          <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={14} color={theme.textFaint} />
        )}
      </View>
      {open && canExpand && (
        <Text style={styles.body} numberOfLines={40}>
          {body}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// Linha genérica "Pensando…"/"Executando…" — conferido em
// packages/app/src/pages/session/timeline/{rows.ts,timeline-static-rows.tsx}:
// aparece enquanto a sessão está "busy", troca pro rótulo de execução
// quando alguma tool está com status "running", e SOME por completo
// assim que a sessão termina (não fica na tela junto com a resposta
// final — só os cards de tool ficam, isso já é permanente por padrão).
export function ThinkingRow({ theme, executing }: { theme: Theme; executing: boolean }) {
  const styles = createCardStyles(theme, false);
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <AnimatedIcon icon="bulb-outline" color={theme.textDim} active />
        <ShimmerLabel text={executing ? 'Executando…' : 'Pensando…'} active style={styles.title} />
      </View>
    </View>
  );
}

// Card de "pensamento" com o texto real do reasoning — só existe
// quando settings.showReasoningSummaries está ligado (Configurações →
// Conversa). Colapsado por padrão, igual ao BasicTool do desktop.
export function ReasoningCard({ part, theme }: { part: ReasoningPart; theme: Theme }) {
  const [open, setOpen] = useState(false);
  const isPending = !part.time?.end;
  const styles = createCardStyles(theme, false);

  return (
    <TouchableOpacity
      activeOpacity={part.text ? 0.7 : 1}
      disabled={!part.text}
      onPress={() => setOpen((o) => !o)}
      style={styles.card}
    >
      <View style={styles.row}>
        <AnimatedIcon icon="bulb-outline" color={theme.textDim} active={isPending} />
        <ShimmerLabel text="Pensando…" active={isPending} style={styles.title} />
        {!!part.text && (
          <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={14} color={theme.textFaint} />
        )}
      </View>
      {open && !!part.text && (
        <Text style={styles.body} numberOfLines={60}>
          {part.text}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// Card inline pro estado "retry" de SessionStatus — igual ao
// session-retry.tsx do desktop: card no fluxo da conversa, não um
// badge de header. "idle"/"busy" não precisam de UI própria aqui.
export function RetryCard({
  theme,
  attempt,
  message,
}: {
  theme: Theme;
  attempt: number;
  message: string;
}) {
  const styles = createCardStyles(theme, true);
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Ionicons name="warning-outline" size={16} color={theme.danger} />
        <Text style={[styles.title, { color: theme.danger }]}>
          Tentativa {attempt}… {message}
        </Text>
      </View>
    </View>
  );
}

function createCardStyles(theme: Theme, isError: boolean) {
  return StyleSheet.create({
    card: {
      alignSelf: 'stretch',
      backgroundColor: theme.toolBg,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 9,
      marginTop: 4,
      ...(isError
        ? { borderWidth: 1, borderColor: theme.danger }
        : { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.toolBorder }),
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      fontSize: 13,
      fontWeight: '500',
      color: isError ? theme.danger : theme.textDim,
    },
    body: {
      marginTop: 6,
      fontSize: 12,
      color: theme.textDim,
      fontFamily: 'monospace',
    },
  });
}
