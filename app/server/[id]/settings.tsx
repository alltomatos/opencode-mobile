import Constants from 'expo-constants';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Row } from '../../../src/components/ui/Row';
import { Section } from '../../../src/components/ui/Section';
import { getMemoryConfig, setMemoryConfig } from '../../../src/lib/api';
import {
  getNotificationPermissionStatus,
  isNotificationSupportAvailable,
  requestNotificationPermission,
} from '../../../src/lib/notifications';
import { getServerToken, listServers, ServerConnection } from '../../../src/lib/servers';
import { NotificationCategory, ThemeOverride, useSettings } from '../../../src/lib/settings';
import { Theme, useTheme } from '../../../src/lib/theme';

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
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = createStyles(theme);
  const { settings, update } = useSettings();
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'undetermined' | null>(null);
  const notificationsSupported = isNotificationSupportAvailable();
  const [server, setServer] = useState<ServerConnection | null>(null);
  const [token, setToken] = useState<string | null>(null);
  // `null` = ainda não carregou; depois disso, `undefined` explícito
  // significa que o GET /memory falhou (servidor fora do ar, rota não
  // implementada nessa build, etc.) — nesse caso escondemos o toggle
  // em vez de mostrar um estado que pode estar errado.
  const [memoryEnabled, setMemoryEnabled] = useState<boolean | null | undefined>(null);

  useEffect(() => {
    if (!notificationsSupported) return;
    getNotificationPermissionStatus().then(setPermissionStatus);
  }, [notificationsSupported]);

  useEffect(() => {
    listServers().then(async (list) => {
      const found = list.find((s) => s.id === id) ?? null;
      setServer(found);
      if (!found) return;
      const t = await getServerToken(found.id);
      setToken(t);
      if (!t) return;
      getMemoryConfig(found, t)
        .then((config) => setMemoryEnabled(config.enabled !== false))
        .catch(() => setMemoryEnabled(undefined));
    });
  }, [id]);

  async function handleToggleServerMemory(value: boolean) {
    if (!server || !token) return;
    setMemoryEnabled(value);
    try {
      await setMemoryConfig(server, token, { enabled: value });
    } catch {
      setMemoryEnabled(!value);
    }
  }

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
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Section title="Aparência">
        <View style={styles.segmentedRow}>
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
      </Section>

      <Section title="Conversa">
        <Row
          title={'Mostrar resumo do "pensamento"'}
          subtitle="Exibe o raciocínio do modelo como um card, quando ele emitir. Desligado por padrão, igual ao desktop."
          accessory={
            <Switch
              value={settings.showReasoningSummaries}
              onValueChange={(value) => update({ showReasoningSummaries: value })}
              trackColor={{ true: theme.accent, false: theme.border }}
            />
          }
        />
        <Row
          title="Expandir tools automaticamente"
          subtitle="Cards de shell/edição já aparecem abertos, sem precisar tocar."
          accessory={
            <Switch
              value={settings.toolPartsExpanded}
              onValueChange={(value) => update({ toolPartsExpanded: value })}
              trackColor={{ true: theme.accent, false: theme.border }}
            />
          }
          last
        />
      </Section>

      {memoryEnabled !== null && memoryEnabled !== undefined && (
        <Section title="Memória" footer={`Configuração salva no servidor "${server?.label}", não no app. Cada projeto também tem a própria memória (gerenciável na tela de sessões dele).`}>
          <Row
            title="Memória neste servidor"
            accessory={
              <Switch
                value={memoryEnabled}
                onValueChange={handleToggleServerMemory}
                trackColor={{ true: theme.accent, false: theme.border }}
              />
            }
            last
          />
        </Section>
      )}

      <Section
        title="Notificações"
        footer={
          notificationsSupported
            ? Platform.OS === 'android'
              ? 'Notificações locais — disparadas pelo próprio app enquanto ele está aberto ou recém-minimizado. Não chegam com o app fechado pelo sistema (isso exigiria um build próprio, fora do Expo Go).'
              : 'Notificações locais — disparadas pelo próprio app enquanto ele está aberto ou recém-minimizado.'
            : undefined
        }
      >
        {!notificationsSupported ? (
          <View style={styles.warnBox}>
            <Text style={styles.warnText}>
              Notificações (mesmo locais) não funcionam no Android dentro do Expo Go — a partir do SDK 53 a
              Expo removeu esse suporte de lá; só um build próprio do app (dev build/EAS) habilita isso.
            </Text>
          </View>
        ) : (
          <>
            {permissionStatus === 'denied' && (
              <View style={styles.warnBox}>
                <Text style={styles.warnText}>
                  Permissão de notificação negada pelo sistema. Ative em Ajustes do Android/iOS.
                </Text>
              </View>
            )}
            {NOTIFICATION_CATEGORIES.map((cat) => (
              <Row
                key={cat.key}
                title={cat.label}
                subtitle={cat.hint}
                accessory={
                  <Switch
                    value={settings.notifications[cat.key]}
                    onValueChange={(value) => handleToggleCategory(cat.key, value)}
                    trackColor={{ true: theme.accent, false: theme.border }}
                  />
                }
              />
            ))}
            <Row
              title="Som"
              accessory={
                <Switch
                  value={settings.notificationSound}
                  onValueChange={(value) => update({ notificationSound: value })}
                  trackColor={{ true: theme.accent, false: theme.border }}
                />
              }
            />
            <Row
              title="Vibração"
              accessory={
                <Switch
                  value={settings.notificationVibration}
                  onValueChange={(value) => update({ notificationVibration: value })}
                  trackColor={{ true: theme.accent, false: theme.border }}
                />
              }
              last
            />
          </>
        )}
      </Section>

      <Section title="Sobre">
        <Row title="Versão" accessory={<Text style={styles.versionText}>{Constants.expoConfig?.version ?? '—'}</Text>} last />
      </Section>
    </ScrollView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    scroll: {
      padding: 16,
      gap: 20,
    },
    segmentedRow: {
      padding: 12,
    },
    segmented: {
      flexDirection: 'row',
      backgroundColor: theme.bgAlt,
      borderRadius: 9,
      padding: 2,
      gap: 2,
    },
    segment: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: 7,
      alignItems: 'center',
    },
    segmentActive: {
      backgroundColor: theme.surface,
    },
    segmentText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textDim,
    },
    segmentTextActive: {
      color: theme.accent,
    },
    warnBox: {
      padding: 12,
    },
    warnText: {
      fontSize: 13,
      color: theme.warnText,
      lineHeight: 18,
    },
    versionText: {
      fontSize: 16,
      color: theme.textDim,
    },
  });
}
