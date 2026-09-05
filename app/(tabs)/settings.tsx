import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
} from '../../src/lib/notifications';
import { NotificationCategory, ThemeOverride, useSettings } from '../../src/lib/settings';
import { Theme, useTheme } from '../../src/lib/theme';

const THEME_OPTIONS: { value: ThemeOverride; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
];

const NOTIFICATION_CATEGORIES: { key: NotificationCategory; label: string; hint: string }[] = [
  { key: 'agentDone', label: 'Resposta do agente', hint: 'Avisa quando o agente termina de responder.' },
  { key: 'permissions', label: 'Pedidos de permissão', hint: 'Avisa quando o agente precisa de autorização pra agir.' },
  { key: 'errors', label: 'Erros', hint: 'Avisa quando um envio ou comando falha.' },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = createStyles(theme);
  const { settings, update } = useSettings();
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'undetermined' | null>(null);

  useEffect(() => {
    getNotificationPermissionStatus().then(setPermissionStatus);
  }, []);

  async function handleToggleCategory(key: NotificationCategory, value: boolean) {
    // Só pede a permissão do sistema na hora que a pessoa realmente
    // tenta ligar alguma notificação — não no boot do app, pra não
    // assustar com um popup de permissão antes de fazer sentido.
    if (value && permissionStatus !== 'granted') {
      const granted = await requestNotificationPermission();
      setPermissionStatus(granted ? 'granted' : 'denied');
      if (!granted) return;
    }
    update({ notifications: { ...settings.notifications, [key]: value } });
  }

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

      <Text style={styles.sectionLabel}>Notificações</Text>
      <View style={styles.card}>
        {permissionStatus === 'denied' && (
          <Text style={styles.warnText}>
            Permissão de notificação negada pelo sistema. Ative em Ajustes do Android/iOS pra essas opções
            funcionarem.
          </Text>
        )}
        {NOTIFICATION_CATEGORIES.map((cat, i) => (
          <View key={cat.key}>
            {i > 0 && <View style={styles.divider} />}
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={styles.rowTitle}>{cat.label}</Text>
                <Text style={styles.rowSubtitle}>{cat.hint}</Text>
              </View>
              <Switch
                value={settings.notifications[cat.key]}
                onValueChange={(value) => handleToggleCategory(cat.key, value)}
                trackColor={{ true: theme.accent, false: theme.border }}
              />
            </View>
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.switchRow}>
          <Text style={[styles.rowTitle, styles.switchLabel]}>Som</Text>
          <Switch
            value={settings.notificationSound}
            onValueChange={(value) => update({ notificationSound: value })}
            trackColor={{ true: theme.accent, false: theme.border }}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.switchRow}>
          <Text style={[styles.rowTitle, styles.switchLabel]}>Vibração</Text>
          <Switch
            value={settings.notificationVibration}
            onValueChange={(value) => update({ notificationVibration: value })}
            trackColor={{ true: theme.accent, false: theme.border }}
          />
        </View>
      </View>
      <Text style={styles.hintBelow}>
        {Platform.OS === 'android'
          ? 'Notificações locais — disparadas pelo próprio app enquanto ele está aberto ou recém-minimizado. Não chegam com o app fechado pelo sistema (isso exigiria um build próprio, fora do Expo Go).'
          : 'Notificações locais — disparadas pelo próprio app enquanto ele está aberto ou recém-minimizado.'}
      </Text>

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
    warnText: {
      fontSize: 12,
      color: theme.warnText,
      backgroundColor: theme.warnBg,
      borderWidth: 1,
      borderColor: theme.warnBorder,
      borderRadius: 8,
      padding: 8,
    },
    hintBelow: {
      fontSize: 11,
      color: theme.textFaint,
      marginTop: -12,
      lineHeight: 15,
    },
    aboutRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
  });
}
