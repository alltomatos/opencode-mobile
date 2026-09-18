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
      // Mostra o banner e lista sempre para não perder avisos mesmo navegando
      // em outras abas do app; o som é emitido principalmente quando em background.
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: AppState.currentState !== 'active',
      shouldSetBadge: false,
    }),
  });
}

const CHANNELS: Record<NotificationCategory, { id: string; name: string }> = {
  agentDone: { id: 'agent-done', name: 'Respostas do agente' },
  permissions: { id: 'permissions', name: 'Pedidos de permissão' },
  batuta: { id: 'batuta', name: 'Atividades Batuta' },
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

export type NotificationData = {
  url?: string;
  sessionId?: string;
  serverId?: string;
  projectId?: string;
  activityId?: string;
  [key: string]: unknown;
};

async function notify(
  category: NotificationCategory,
  settings: AppSettings,
  title: string,
  body: string,
  data?: NotificationData
) {
  if (!Notifications) return;
  if (!settings.notifications[category]) return;
  let granted = await getNotificationPermissionStatus();
  if (granted === 'undetermined') {
    const ok = await requestNotificationPermission();
    granted = ok ? 'granted' : 'denied';
  }
  if (granted !== 'granted') return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: settings.notificationSound ? 'default' : undefined,
      vibrate: settings.notificationVibration ? [0, 250, 150, 250] : undefined,
      data: data ?? {},
    },
    // Conferido contra o tipo público real (expo-notifications/build/
    // Notifications.types.d.ts, ChannelAwareTriggerInput): disparo
    // imediato com canal específico no Android é só `{ channelId }`,
    // sem campo `type` — `{ type: 'immediate' }` não existe na lib.
    trigger: Platform.OS === 'android' ? { channelId: CHANNELS[category].id } : null,
  }).catch(() => {});
}

export function notifyAgentDone(settings: AppSettings, sessionTitle: string, data?: NotificationData) {
  return notify('agentDone', settings, sessionTitle || 'Sessão', 'O agente terminou de responder.', data);
}

export function notifyPermissionAsked(settings: AppSettings, permission: string, data?: NotificationData) {
  return notify('permissions', settings, 'Permissão pedida', `O agente quer permissão para: ${permission}`, data);
}

export function notifyQuestionAsked(settings: AppSettings, question: string, data?: NotificationData) {
  return notify('permissions', settings, 'Pergunta do agente', question, data);
}

export function notifyBatutaDone(settings: AppSettings, activityTitle: string, success: boolean, data?: NotificationData) {
  return notify(
    'batuta',
    settings,
    activityTitle || 'Atividade Batuta',
    success ? 'Atividade concluída com sucesso.' : 'Atividade finalizada com erro.',
    data
  );
}

export function notifyError(settings: AppSettings, message: string, data?: NotificationData) {
  return notify('errors', settings, 'Erro', message, data);
}

export function addNotificationResponseListener(listener: (data: NotificationData) => void): () => void {
  if (!Notifications) return () => {};
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as NotificationData;
    if (data) {
      listener(data);
    }
  });
  return () => {
    subscription.remove();
  };
}

export async function getLastNotificationResponse(): Promise<NotificationData | null> {
  if (!Notifications) return null;
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    return (response?.notification.request.content.data as NotificationData) ?? null;
  } catch {
    return null;
  }
}
