import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Row } from '../../../src/components/ui/Row';
import { Section } from '../../../src/components/ui/Section';
import {
  getMemoryConfig,
  listProviderCatalog,
  listProviders,
  ProviderCatalogItem,
  ProviderList,
  sendOAuthCallback,
  setMemoryConfig,
  startOAuthAuthorize,
  updateConfig,
} from '../../../src/lib/api';
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
  const [providers, setProviders] = useState<ProviderList | null>(null);
  const [catalog, setCatalog] = useState<Record<string, ProviderCatalogItem> | null>(null);
  const [showAddProviderModal, setShowAddProviderModal] = useState(false);
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<ProviderCatalogItem | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingProvider, setSavingProvider] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);

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
      listProviders(found, t).then(setProviders).catch(() => {});
      listProviderCatalog(found, t).then(setCatalog).catch(() => {});
    });
  }, [id]);

  async function refreshProviders() {
    if (!server || !token) return;
    try {
      const list = await listProviders(server, token);
      setProviders(list);
    } catch {}
  }

  async function handleSaveApiKey() {
    if (!server || !token || !selectedCatalogItem || !apiKeyInput.trim()) return;
    setSavingProvider(true);
    setProviderError(null);
    try {
      await updateConfig(server, token, {
        provider: {
          [selectedCatalogItem.id]: {
            options: {
              apiKey: apiKeyInput.trim(),
            },
          },
        },
      });
      setApiKeyInput('');
      setSelectedCatalogItem(null);
      setShowAddProviderModal(false);
      await refreshProviders();
    } catch (e) {
      setProviderError(e instanceof Error ? e.message : 'Falha ao salvar chave de API.');
    } finally {
      setSavingProvider(false);
    }
  }

  async function handleStartOAuth(item: ProviderCatalogItem) {
    if (!server || !token) return;
    setSavingProvider(true);
    setProviderError(null);
    try {
      const authRes = await startOAuthAuthorize(server, token, item.id);
      const redirectUrl = Linking.createURL('oauth-callback');
      const result = await WebBrowser.openAuthSessionAsync(authRes.url, redirectUrl);
      if (result.type === 'success' && result.url) {
        await sendOAuthCallback(server, token, item.id, result.url);
        setSelectedCatalogItem(null);
        setShowAddProviderModal(false);
        await refreshProviders();
      }
    } catch (e) {
      setProviderError(e instanceof Error ? e.message : 'Falha na autorização OAuth.');
    } finally {
      setSavingProvider(false);
    }
  }

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

      <Section
        title="Provedores de IA"
        footer="Provedores conectados no servidor. Adicione novos usando chaves de API ou login OAuth."
      >
        {providers?.connected && providers.connected.length > 0 ? (
          providers.connected.map((pId, idx) => {
            const providerInfo = providers.all.find((p) => p.id === pId);
            const isLast = idx === providers.connected.length - 1;
            return (
              <Row
                key={pId}
                title={providerInfo?.name || pId}
                subtitle={`${Object.keys(providerInfo?.models || {}).length} modelos disponíveis`}
                accessory={<Ionicons name="checkmark-circle" size={20} color={theme.accent} />}
                last={isLast}
              />
            );
          })
        ) : (
          <Row title="Nenhum provedor conectado" subtitle="Toque em Adicionar para configurar" last />
        )}
        <View style={styles.addProviderRow}>
          <TouchableOpacity style={styles.addProviderBtn} onPress={() => setShowAddProviderModal(true)}>
            <Ionicons name="add-circle-outline" size={18} color={theme.accent} style={{ marginRight: 6 }} />
            <Text style={styles.addProviderBtnText}>Adicionar Provedor</Text>
          </TouchableOpacity>
        </View>
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

      <Modal
        visible={showAddProviderModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowAddProviderModal(false);
          setSelectedCatalogItem(null);
          setProviderError(null);
        }}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => {
            setShowAddProviderModal(false);
            setSelectedCatalogItem(null);
            setProviderError(null);
          }}
        >
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalGrabber} />
            <Text style={styles.modalTitle}>Adicionar Provedor de IA</Text>

            {providerError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{providerError}</Text>
              </View>
            )}

            {!selectedCatalogItem ? (
              <ScrollView style={styles.catalogScroll}>
                {catalog &&
                  Object.values(catalog).map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.catalogRow}
                      onPress={() => {
                        setProviderError(null);
                        if (item.oauth) {
                          handleStartOAuth(item);
                        } else {
                          setSelectedCatalogItem(item);
                        }
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.catalogName}>{item.name}</Text>
                        <Text style={styles.catalogSubtitle}>
                          {item.oauth ? 'Login via OAuth' : 'Chave de API'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={theme.textFaint} />
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            ) : (
              <View style={styles.apiKeyForm}>
                <Text style={styles.catalogName}>{selectedCatalogItem.name}</Text>
                <Text style={styles.catalogSubtitle}>Digite sua chave de API ({selectedCatalogItem.env?.[0] || 'API_KEY'})</Text>
                <TextInput
                  style={styles.apiKeyInput}
                  placeholder="sk-..."
                  placeholderTextColor={theme.placeholder}
                  value={apiKeyInput}
                  onChangeText={setApiKeyInput}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <View style={styles.formBtnRow}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setSelectedCatalogItem(null)}
                    disabled={savingProvider}
                  >
                    <Text style={styles.cancelBtnText}>Voltar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, !apiKeyInput.trim() && styles.saveBtnDisabled]}
                    onPress={handleSaveApiKey}
                    disabled={!apiKeyInput.trim() || savingProvider}
                  >
                    {savingProvider ? (
                      <ActivityIndicator color={theme.accentText} size="small" />
                    ) : (
                      <Text style={styles.saveBtnText}>Salvar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
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
    addProviderRow: {
      padding: 12,
    },
    addProviderBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bgAlt,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
    },
    addProviderBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.accent,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 16,
      paddingBottom: 32,
      maxHeight: '80%',
    },
    modalGrabber: {
      alignSelf: 'center',
      width: 36,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.border,
      marginTop: 8,
      marginBottom: 12,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 12,
    },
    errorBox: {
      backgroundColor: 'rgba(255, 59, 48, 0.1)',
      padding: 10,
      borderRadius: 8,
      marginBottom: 12,
    },
    errorText: {
      color: theme.warnText,
      fontSize: 13,
    },
    catalogScroll: {
      maxHeight: 320,
    },
    catalogRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    catalogName: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
    },
    catalogSubtitle: {
      fontSize: 12,
      color: theme.textDim,
      marginTop: 2,
    },
    apiKeyForm: {
      gap: 12,
      paddingVertical: 8,
    },
    apiKeyInput: {
      backgroundColor: theme.bgAlt,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 15,
      color: theme.text,
    },
    formBtnRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
      marginTop: 12,
    },
    cancelBtn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: theme.bgAlt,
    },
    cancelBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textDim,
    },
    saveBtn: {
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 10,
      backgroundColor: theme.accent,
    },
    saveBtnDisabled: {
      backgroundColor: theme.accentDim,
    },
    saveBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.accentText,
    },
  });
}
