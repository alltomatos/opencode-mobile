import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Theme, useTheme } from '../../lib/theme';

type IoniconName = keyof typeof Ionicons.glyphMap;

// Estado vazio padrão do redesign: ícone num círculo suave, título,
// explicação — em vez de uma frase cinza sozinha no meio da tela
// (regra do HIG/skill: sempre orientar o que fazer, nunca deixar em
// branco).
export function EmptyState({ icon, title, subtitle }: { icon: IoniconName; title: string; subtitle?: string }) {
  const theme = useTheme();
  const styles = createStyles(theme);
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={32} color={theme.textFaint} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    wrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      paddingTop: 48,
      gap: 6,
    },
    iconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.bgAlt,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    title: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.text,
    },
    subtitle: {
      fontSize: 14,
      color: theme.textDim,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
}
