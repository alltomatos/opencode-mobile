import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Theme, useTheme } from '../../lib/theme';

// "Grouped table view" do iOS: título em caixa alta cinza acima, card
// branco/cinza-escuro arredondado por baixo com as linhas dentro
// (Row.tsx cuida do divisor entre elas). Base de toda tela de lista/
// configuração no redesign — usar em vez de cards soltos avulsos.
export function Section({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  const styles = createStyles(theme);
  return (
    <View style={styles.wrap}>
      {title && <Text style={styles.title}>{title}</Text>}
      <View style={styles.card}>{children}</View>
      {footer && <Text style={styles.footer}>{footer}</Text>}
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    wrap: {
      gap: 7,
    },
    title: {
      fontSize: 13,
      fontWeight: '400',
      color: theme.textDim,
      textTransform: 'uppercase',
      letterSpacing: 0.2,
      paddingHorizontal: 16,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      overflow: 'hidden',
    },
    footer: {
      fontSize: 13,
      color: theme.textDim,
      paddingHorizontal: 16,
      lineHeight: 18,
    },
  });
}
