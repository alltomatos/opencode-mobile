import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Part, ReasoningPart, ToolPart } from '../lib/api';
import { Theme } from '../lib/theme';

// Ids reais conferidos em D:\dev\opencode\packages\opencode\src\tool\*.ts
// (cada arquivo passa esse literal pro primeiro argumento de
// Tool.define) — shell.ts usa "bash", não "shell"; apply_patch.ts usa
// "apply_patch"; todo.ts usa "todowrite". Ver docs/prd/mobile-app.md.
const TOOL_META: Record<string, { icon: string; label: string }> = {
  bash: { icon: '💻', label: 'Shell' },
  read: { icon: '👓', label: 'Lendo arquivo' },
  write: { icon: '📝', label: 'Escrevendo arquivo' },
  edit: { icon: '✏️', label: 'Editando arquivo' },
  apply_patch: { icon: '✏️', label: 'Aplicando patch' },
  glob: { icon: '🔍', label: 'Buscando arquivos' },
  grep: { icon: '🔍', label: 'Buscando texto' },
  webfetch: { icon: '🌐', label: 'Buscando página' },
  websearch: { icon: '🌐', label: 'Pesquisando na web' },
  task: { icon: '🧩', label: 'Subagente' },
  skill: { icon: '🧠', label: 'Skill' },
  question: { icon: '❓', label: 'Pergunta' },
  memory_search: { icon: '🧠', label: 'Buscando na memória' },
  memory_save: { icon: '🧠', label: 'Salvando na memória' },
  lsp: { icon: '🔧', label: 'LSP' },
  plan_exit: { icon: '📋', label: 'Plano' },
  browser: { icon: '🖥️', label: 'Navegador' },
  computer: { icon: '🖥️', label: 'Computador' },
};

// Partes que o desktop não mostra na timeline (session-ui/message-part.tsx
// HIDDEN_TOOLS + step-start/step-finish são só marcadores de agrupamento).
export function isHiddenPart(part: Part): boolean {
  if (part.type === 'step-start' || part.type === 'step-finish') return true;
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

function ShimmerLabel({ text, active, style }: { text: string; active: boolean; style: object }) {
  const opacity = useShimmer(active);
  return (
    <Animated.Text style={[style, active ? { opacity } : undefined]} numberOfLines={1}>
      {text}
    </Animated.Text>
  );
}

// Card de tool: colapsado por padrão, expande só quando concluído (ou
// com erro) — igual ao BasicTool do desktop (session-ui/basic-tool.tsx).
// `skill` nunca expande (hideDetails no desktop): só a linha shimmer.
export function ToolCard({ part, theme }: { part: ToolPart; theme: Theme }) {
  const [open, setOpen] = useState(false);
  const meta = TOOL_META[part.tool] ?? { icon: '🔧', label: part.tool };
  const isPending = part.state.status === 'pending' || part.state.status === 'running';
  const isError = part.state.status === 'error';
  const hideDetails = part.tool === 'skill';
  const title = part.state.title || meta.label;
  const styles = createCardStyles(theme, isError);

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
        <Text style={styles.icon}>{meta.icon}</Text>
        <ShimmerLabel text={isPending ? `${title}…` : title} active={isPending} style={styles.title} />
        {canExpand && <Text style={styles.caret}>{open ? '▾' : '▸'}</Text>}
      </View>
      {open && canExpand && (
        <Text style={styles.body} numberOfLines={40}>
          {body}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// "Thinking…" — colapsado por padrão, revela o texto streamado ao
// tocar (message-part.tsx: BasicTool icon="brain" defaultOpen={false}).
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
        <Text style={styles.icon}>🧠</Text>
        <ShimmerLabel text="Pensando…" active={isPending} style={styles.title} />
        {!!part.text && <Text style={styles.caret}>{open ? '▾' : '▸'}</Text>}
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
        <Text style={styles.icon}>⚠️</Text>
        <Text style={[styles.title, { color: theme.danger }]}>Tentativa {attempt}… {message}</Text>
      </View>
    </View>
  );
}

function createCardStyles(theme: Theme, isError: boolean) {
  return StyleSheet.create({
    card: {
      alignSelf: 'stretch',
      backgroundColor: theme.toolBg,
      borderWidth: 1,
      borderColor: isError ? theme.danger : theme.toolBorder,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginTop: 4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    icon: {
      fontSize: 13,
    },
    title: {
      flex: 1,
      fontSize: 12,
      fontWeight: '600',
      color: isError ? theme.danger : theme.textDim,
    },
    caret: {
      fontSize: 11,
      color: theme.textFaint,
    },
    body: {
      marginTop: 6,
      fontSize: 12,
      color: theme.textDim,
      fontFamily: 'monospace',
    },
  });
}
