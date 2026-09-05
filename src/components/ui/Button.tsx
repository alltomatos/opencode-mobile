import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { Theme, useTheme } from '../../lib/theme';

// Botão cheio estilo iOS (cantos bem arredondados, cor sólida) — usado
// pra UMA ação primária por tela (regra do HIG: só um CTA primário).
export function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
  destructive,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  destructive?: boolean;
}) {
  const theme = useTheme();
  const styles = createStyles(theme, destructive);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.button, (disabled || loading) && styles.buttonDisabled]}
      android_ripple={{ color: theme.accentDim }}
    >
      {loading ? (
        <ActivityIndicator color={theme.accentText} />
      ) : (
        <Text style={styles.text}>{title}</Text>
      )}
    </Pressable>
  );
}

// Botão de texto simples (cor de destaque, sem preenchimento) — ações
// secundárias, estilo "link" de UIAlertAction/toolbar do iOS.
export function TextButton({
  title,
  onPress,
  destructive,
}: {
  title: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.textButtonHit}>
      <Text style={[styles.textButton, { color: destructive ? theme.danger : theme.accent }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  textButtonHit: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textButton: {
    fontSize: 17,
    fontWeight: '600',
  },
});

function createStyles(theme: Theme, destructive?: boolean) {
  return StyleSheet.create({
    button: {
      minHeight: 50,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: destructive ? theme.danger : theme.accent,
      paddingHorizontal: 20,
    },
    buttonDisabled: {
      opacity: 0.4,
    },
    text: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.accentText,
    },
  });
}
