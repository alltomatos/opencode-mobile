import Constants from 'expo-constants';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemeOverride, useSettings } from '../../src/lib/settings';
import { Theme, useTheme } from '../../src/lib/theme';

const THEME_OPTIONS: { value: ThemeOverride; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = createStyles(theme);
  const { settings, update } = useSettings();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
      <Text style={styles.sectionLabel}>Aparência</Text>
      <View style={styles.card}>
        <Text style={styles.rowTitle}>Tema</Text>
        <View style={styles.segmented}>
          {THEME_OPTIONS.map((opt) => {
            const active = settings.themeOverride === opt.value;
            return (
              <View
                key={opt.value}
                onTouchEnd={() => update({ themeOverride: opt.value })}
                style={[styles.segment, active && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <Text style={styles.sectionLabel}>Conversa</Text>
      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Text style={styles.rowTitle}>Mostrar resumo do "pensamento"</Text>
            <Text style={styles.rowSubtitle}>
              Exibe o texto de raciocínio do modelo como um card, quando o modelo emitir. Desligado por
              padrão — igual ao app desktop.
            </Text>
          </View>
          <Switch
            value={settings.showReasoningSummaries}
            onValueChange={(value) => update({ showReasoningSummaries: value })}
            trackColor={{ true: theme.accent, false: theme.border }}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Text style={styles.rowTitle}>Expandir tools automaticamente</Text>
            <Text style={styles.rowSubtitle}>
              Cards de shell/edição já aparecem abertos, sem precisar tocar pra ver o resultado.
            </Text>
          </View>
          <Switch
            value={settings.toolPartsExpanded}
            onValueChange={(value) => update({ toolPartsExpanded: value })}
            trackColor={{ true: theme.accent, false: theme.border }}
          />
        </View>
      </View>

      <Text style={styles.sectionLabel}>Sobre</Text>
      <View style={styles.card}>
        <View style={styles.aboutRow}>
          <Text style={styles.rowTitle}>Versão</Text>
          <Text style={styles.rowSubtitle}>{Constants.expoConfig?.version ?? '—'}</Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: 16,
      gap: 20,
      backgroundColor: theme.bg,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textFaint,
      textTransform: 'uppercase',
      marginBottom: -8,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      gap: 14,
    },
    rowTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
    },
    rowSubtitle: {
      fontSize: 12,
      color: theme.textDim,
      marginTop: 4,
      lineHeight: 17,
    },
    segmented: {
      flexDirection: 'row',
      backgroundColor: theme.bgAlt,
      borderRadius: 10,
      padding: 3,
      gap: 3,
    },
    segment: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      alignItems: 'center',
    },
    segmentActive: {
      backgroundColor: theme.accent,
    },
    segmentText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textDim,
    },
    segmentTextActive: {
      color: theme.accentText,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    switchLabel: {
      flex: 1,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
    },
    aboutRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
  });
}
