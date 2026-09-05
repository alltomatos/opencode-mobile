import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Theme, useTheme } from '../../lib/theme';

type IoniconName = keyof typeof Ionicons.glyphMap;

// Linha de lista agrupada estilo iOS Settings: badge de ícone colorido
// opcional à esquerda, título/subtítulo, acessório à direita (chevron
// por padrão quando tem onPress, ou qualquer node customizado — texto,
// Switch, spinner). `last` tira o divisor de baixo (a última linha de
// cada Section não deve ter).
export function Row({
  icon,
  iconColor,
  title,
  subtitle,
  accessory,
  onPress,
  destructive,
  disabled,
  loading,
  last,
  numberOfLinesTitle = 1,
}: {
  icon?: IoniconName;
  iconColor?: string;
  title: string;
  subtitle?: string;
  accessory?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  loading?: boolean;
  last?: boolean;
  numberOfLinesTitle?: number;
}) {
  const theme = useTheme();
  const styles = createStyles(theme, destructive);
  const showChevron = !!onPress && accessory === undefined;

  const content = (
    <View style={[styles.row, !last && styles.rowDivider]}>
      {icon && (
        <View style={[styles.iconBadge, { backgroundColor: iconColor ?? theme.accent }]}>
          <Ionicons name={icon} size={16} color="#fff" />
        </View>
      )}
      <View style={styles.texts}>
        <Text style={styles.title} numberOfLines={numberOfLinesTitle}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={theme.textFaint} />
      ) : (
        accessory ?? (showChevron && <Ionicons name="chevron-forward" size={18} color={theme.textFaint} />)
      )}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      android_ripple={{ color: theme.border }}
      style={disabled ? styles.disabled : undefined}
    >
      {content}
    </Pressable>
  );
}

function createStyles(theme: Theme, destructive?: boolean) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 44,
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    iconBadge: {
      width: 28,
      height: 28,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
    },
    texts: {
      flex: 1,
      gap: 1,
    },
    title: {
      fontSize: 16,
      fontWeight: '400',
      color: destructive ? theme.danger : theme.text,
    },
    subtitle: {
      fontSize: 13,
      color: theme.textDim,
      lineHeight: 17,
    },
    disabled: {
      opacity: 0.4,
    },
  });
}
