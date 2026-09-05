import { isRunningInExpoGo } from 'expo';
import type * as NotificationsType from 'expo-notifications';
import { AppState, Platform } from 'react-native';

import { AppSettings, NotificationCategory } from './settings';

// Push remoto (servidor mandando notificação de fora) não funciona no
// Expo Go a partir do SDK 53 (precisa de dev build) — conferido na doc
// oficial antes de implementar. O que ninguém documenta com a mesma
// clareza, e só apareceu testando ao vivo: no Android, só de dar
// `import * as Notifications from 'expo-notifications'` a lib já
// registra um listener de push token como efeito colateral do próprio
// import (DevicePushTokenAutoRegistration.fx.js → addPushTokenListener
// → warnOfExpoGoPushUsage), e isso lança uma exceção SÍNCRONA dentro
// do Expo Go — derrubando o app inteiro na inicialização, mesmo sem
// nenhum código nosso chamar API de push. A única forma de evitar é
// nunca importar o módulo nesse ambiente específico (Android + Expo
// Go) — daqui pra baixo, tudo é `require()` condicional, não
// `import` no topo do arquivo.
const UNAVAILABLE = Platform.OS === 'android' && isRunningInExpoGo();

function loadNotifications(): typeof NotificationsType | null {
  if (UNAVAILABLE) return null;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('expo-notifications') as typeof NotificationsType;
}

const Notifications = loadNotifications();

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      // Só mostra o alerta/som visualmente quando o app não está em
      // primeiro plano — em foreground o usuário já está vendo o card
      // de permissão/a resposta chegando na tela, notificação ali só
      // duplicaria informação.
      shouldShowBanner: AppState.currentState !== 'active',
      shouldShowList: AppState.currentState !== 'active',
      shouldPlaySound: AppState.currentState !== 'active',
      shouldSetBadge: false,
    }),
  });
}

const CHANNELS: Record<NotificationCategory, { id: string; name: string }> = {
  agentDone: { id: 'agent-done', name: 'Respostas do agente' },
  permissions: { id: 'permissions', name: 'Pedidos de permissão' },
  errors: { id: 'errors', name: 'Erros' },
};

// `false` aqui não significa "negada pelo sistema" — pode ser porque a
// plataforma nem suporta (Android + Expo Go). A tela de Configurações
// usa isso pra saber se deve mostrar os toggles ou um aviso.
export function isNotificationSupportAvailable(): boolean {
  return Notifications !== null;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Notifications) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const result = await Notifications.requestPermissionsAsync();
  return result.granted;
}

export async function getNotificationPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (!Notifications) return 'denied';
  const result = await Notifications.getPermissionsAsync();
  if (result.granted) return 'granted';
  return result.canAskAgain ? 'undetermined' : 'denied';
}

// Canais do Android guardam som/vibração — como o usuário pode mudar
// esses toggles em Configurações a qualquer momento, isso é chamado de
// novo sempre que `notificationSound`/`notificationVibration` mudam
// (setNotificationChannelAsync sobrescreve o canal existente, não
// duplica). No iOS não existe o conceito de canal — o som já vem do
// campo `sound` de cada notificação individual.
export async function syncNotificationChannels(settings: AppSettings): Promise<void> {
  if (!Notifications || Platform.OS !== 'android') return;
  for (const { id, name } of Object.values(CHANNELS)) {
    await Notifications.setNotificationChannelAsync(id, {
      name,
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: settings.notificationVibration ? [0, 250, 150, 250] : undefined,
      sound: settings.notificationSound ? 'default' : undefined,
      enableVibrate: settings.notificationVibration,
    });
  }
}

async function notify(category: NotificationCategory, settings: AppSettings, title: string, body: string) {
  if (!Notifications) return;
  if (!settings.notifications[category]) return;
  const granted = await getNotificationPermissionStatus();
  if (granted !== 'granted') return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: settings.notificationSound ? 'default' : undefined,
      vibrate: settings.notificationVibration ? [0, 250, 150, 250] : undefined,
    },
    // Conferido contra o tipo público real (expo-notifications/build/
    // Notifications.types.d.ts, ChannelAwareTriggerInput): disparo
    // imediato com canal específico no Android é só `{ channelId }`,
    // sem campo `type` — `{ type: 'immediate' }` não existe na lib.
    trigger: Platform.OS === 'android' ? { channelId: CHANNELS[category].id } : null,
  }).catch(() => {});
}

export function notifyAgentDone(settings: AppSettings, sessionTitle: string) {
  return notify('agentDone', settings, sessionTitle || 'Sessão', 'O agente terminou de responder.');
}

export function notifyPermissionAsked(settings: AppSettings, permission: string) {
  return notify('permissions', settings, 'Permissão pedida', `O agente quer permissão para: ${permission}`);
}

export function notifyError(settings: AppSettings, message: string) {
  return notify('errors', settings, 'Erro', message);
}
