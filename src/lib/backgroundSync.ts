import AsyncStorage from '@react-native-async-storage/async-storage';
import { isRunningInExpoGo } from 'expo';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { AppState, Platform } from 'react-native';

import {
  BatutaActivity,
  getSessionStatusMap,
  listBatutaActivities,
  listMessages,
  listPermissions,
  listQuestions,
  MessageWithParts,
} from './api';
import {
  notifyAgentDone,
  notifyBatutaDone,
  notifyPermissionAsked,
  notifyQuestionAsked,
} from './notifications';
import { ServerConnection } from './servers';
import { loadSettings } from './settings';

export type ActiveTask = {
  id: string; // sessionId ou activityId
  type: 'session' | 'batuta';
  serverId: string;
  serverUrl: string;
  token: string;
  projectId?: string;
  sessionId?: string;
  sessionTitle?: string;
  activityId?: string;
  activityTitle?: string;
  startedAt: number;
  lastKnownStatus?: 'busy' | 'idle' | 'running' | 'completed' | 'error' | string;
};

const STORAGE_KEY = 'opencode-mobile:active-tasks';
const BACKGROUND_TASK_NAME = 'OPENCODE_BACKGROUND_SYNC_TASK';
const MAX_TASK_AGE_MS = 24 * 60 * 60 * 1000; // 24h para descartar tarefas antigas

const activeTasksMap = new Map<string, ActiveTask>();
const notifiedEvents = new Set<string>();
const turnCompletionListeners = new Map<string, Set<() => void>>();

let backgroundTimer: ReturnType<typeof setInterval> | null = null;
let isChecking = false;

async function persistTasks(): Promise<void> {
  try {
    const list = Array.from(activeTasksMap.values());
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

export async function loadPersistedTasks(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const list = JSON.parse(raw) as ActiveTask[];
    const now = Date.now();
    activeTasksMap.clear();
    for (const task of list) {
      if (now - task.startedAt < MAX_TASK_AGE_MS) {
        activeTasksMap.set(task.id, task);
      }
    }
  } catch {}
}

export function getActiveTasks(): ActiveTask[] {
  return Array.from(activeTasksMap.values());
}

export function isTaskActive(id: string): boolean {
  return activeTasksMap.has(id);
}

function startBackgroundWatchdog(): void {
  if (backgroundTimer) return;
  backgroundTimer = setInterval(() => {
    if (activeTasksMap.size === 0) {
      stopBackgroundWatchdog();
      return;
    }
    checkActiveTasks().catch(() => {});
  }, 3500);
}

function stopBackgroundWatchdog(): void {
  if (backgroundTimer) {
    clearInterval(backgroundTimer);
    backgroundTimer = null;
  }
}

export function registerTurnCompletionListener(sessionId: string, cb: () => void): () => void {
  let set = turnCompletionListeners.get(sessionId);
  if (!set) {
    set = new Set();
    turnCompletionListeners.set(sessionId, set);
  }
  set.add(cb);
  return () => {
    set?.delete(cb);
    if (set && set.size === 0) {
      turnCompletionListeners.delete(sessionId);
    }
  };
}

function notifyTurnCompleted(sessionId: string): void {
  const set = turnCompletionListeners.get(sessionId);
  if (set) {
    for (const cb of set) {
      try {
        cb();
      } catch {}
    }
    turnCompletionListeners.delete(sessionId);
  }
}

function extractLastAssistantText(messages: MessageWithParts[]): string | undefined {
  if (!messages || messages.length === 0) return undefined;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.info?.role === 'assistant' && m.parts) {
      const textParts: string[] = [];
      for (const p of m.parts) {
        if (p.type === 'text') {
          const tPart = p as { text?: string; synthetic?: boolean };
          if (!tPart.synthetic && tPart.text?.trim()) {
            textParts.push(tPart.text.trim());
          }
        }
      }
      if (textParts.length > 0) {
        const full = textParts.join('\n');
        return full.length > 250 ? full.slice(0, 247) + '...' : full;
      }
    }
  }
  return undefined;
}

export function trackActiveSession(
  server: ServerConnection,
  token: string,
  serverId: string,
  projectId: string,
  sessionId: string,
  sessionTitle?: string
): void {
  const task: ActiveTask = {
    id: sessionId,
    type: 'session',
    serverId,
    serverUrl: server.url,
    token,
    projectId,
    sessionId,
    sessionTitle,
    startedAt: Date.now(),
    lastKnownStatus: 'busy',
  };
  activeTasksMap.set(sessionId, task);
  persistTasks().catch(() => {});

  if (AppState.currentState !== 'active') {
    startBackgroundWatchdog();
  }
}

export function untrackActiveSession(sessionId: string): void {
  if (activeTasksMap.delete(sessionId)) {
    persistTasks().catch(() => {});
  }
  if (activeTasksMap.size === 0) {
    stopBackgroundWatchdog();
  }
}

export function trackActiveBatuta(
  server: ServerConnection,
  token: string,
  serverId: string,
  activityId: string,
  activityTitle?: string
): void {
  const task: ActiveTask = {
    id: activityId,
    type: 'batuta',
    serverId,
    serverUrl: server.url,
    token,
    activityId,
    activityTitle,
    startedAt: Date.now(),
    lastKnownStatus: 'running',
  };
  activeTasksMap.set(activityId, task);
  persistTasks().catch(() => {});

  if (AppState.currentState !== 'active') {
    startBackgroundWatchdog();
  }
}

export function untrackActiveBatuta(activityId: string): void {
  if (activeTasksMap.delete(activityId)) {
    persistTasks().catch(() => {});
  }
  if (activeTasksMap.size === 0) {
    stopBackgroundWatchdog();
  }
}

export async function checkActiveTasks(): Promise<boolean> {
  if (isChecking || activeTasksMap.size === 0) return false;
  isChecking = true;

  try {
    const settings = await loadSettings();
    if (!settings.backgroundMonitoring) return false;

    let hadUpdates = false;
    const tasks = Array.from(activeTasksMap.values());

    for (const task of tasks) {
      const server: ServerConnection = {
        id: task.serverId,
        url: task.serverUrl,
        label: '',
      };

      if (task.type === 'session' && task.sessionId) {
        const encodedProj = task.projectId ? encodeURIComponent(decodeURIComponent(task.projectId)) : '';
        const sessionUrl = `/server/${task.serverId}/code/${encodedProj}/session/${task.sessionId}`;

        // 1. Checa pedidos de permissão pendentes
        try {
          const perms = await listPermissions(server, task.token);
          for (const req of perms) {
            if (req.sessionID === task.sessionId) {
              const eventKey = `perm:${req.id}`;
              if (!notifiedEvents.has(eventKey)) {
                notifiedEvents.add(eventKey);
                hadUpdates = true;
                notifyPermissionAsked(settings, req.permission, {
                  url: sessionUrl,
                  serverId: task.serverId,
                  projectId: task.projectId,
                  sessionId: task.sessionId,
                });
              }
            }
          }
        } catch {}

        // 2. Checa perguntas pendentes
        try {
          const questions = await listQuestions(server, task.token);
          for (const req of questions) {
            if (req.sessionID === task.sessionId) {
              const eventKey = `quest:${req.id}`;
              if (!notifiedEvents.has(eventKey)) {
                notifiedEvents.add(eventKey);
                hadUpdates = true;
                notifyQuestionAsked(settings, req.questions[0]?.header ?? 'pergunta do agente', {
                  url: sessionUrl,
                  serverId: task.serverId,
                  projectId: task.projectId,
                  sessionId: task.sessionId,
                });
              }
            }
          }
        } catch {}

        // 3. Checa transição de status (busy -> idle)
        try {
          const statusMap = await getSessionStatusMap(server, task.token);
          const status = statusMap[task.sessionId];

          if (status) {
            if (status.type === 'busy') {
              task.lastKnownStatus = 'busy';
            } else if (status.type === 'idle' && task.lastKnownStatus === 'busy') {
              hadUpdates = true;
              let snippet: string | undefined;
              try {
                const msgs = await listMessages(server, task.token, task.sessionId);
                snippet = extractLastAssistantText(msgs);
              } catch {}

              notifyAgentDone(settings, task.sessionTitle || 'Sessão', snippet, {
                url: sessionUrl,
                serverId: task.serverId,
                projectId: task.projectId,
                sessionId: task.sessionId,
              });
              untrackActiveSession(task.sessionId);
              notifyTurnCompleted(task.sessionId);
            }
          } else if (task.lastKnownStatus === 'busy') {
            // Se não consta mais no mapa de status como busy, considera concluído
            hadUpdates = true;
            let snippet: string | undefined;
            try {
              const msgs = await listMessages(server, task.token, task.sessionId);
              snippet = extractLastAssistantText(msgs);
            } catch {}

            notifyAgentDone(settings, task.sessionTitle || 'Sessão', snippet, {
              url: sessionUrl,
              serverId: task.serverId,
              projectId: task.projectId,
              sessionId: task.sessionId,
            });
            untrackActiveSession(task.sessionId);
            notifyTurnCompleted(task.sessionId);
          }
        } catch {}
      } else if (task.type === 'batuta' && task.activityId) {
        // Checa status da atividade Batuta
        try {
          const activities = await listBatutaActivities(server, task.token);
          const act = activities.find((a: BatutaActivity) => a.id === task.activityId);
          if (act) {
            if (act.status === 'completed') {
              hadUpdates = true;
              notifyBatutaDone(settings, task.activityTitle || act.name, true, {
                url: `/server/${task.serverId}/batuta/${task.activityId}`,
                serverId: task.serverId,
                activityId: task.activityId,
              });
              untrackActiveBatuta(task.activityId);
            } else if (act.status === 'failed' || act.status === 'canceled') {
              hadUpdates = true;
              notifyBatutaDone(settings, task.activityTitle || act.name, false, {
                url: `/server/${task.serverId}/batuta/${task.activityId}`,
                serverId: task.serverId,
                activityId: task.activityId,
              });
              untrackActiveBatuta(task.activityId);
            }
          }
        } catch {}
      }
    }

    return hadUpdates;
  } finally {
    isChecking = false;
  }
}

// Registra tarefa em nível de módulo para que o TaskManager a encontre
if (Platform.OS !== 'web') {
  try {
    TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
      try {
        const hasData = await checkActiveTasks();
        return hasData
          ? BackgroundFetch.BackgroundFetchResult.NewData
          : BackgroundFetch.BackgroundFetchResult.NoData;
      } catch {
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });
  } catch {}
}

export async function initBackgroundSync(): Promise<void> {
  await loadPersistedTasks();

  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      stopBackgroundWatchdog();
      checkActiveTasks().catch(() => {});
    } else {
      if (activeTasksMap.size > 0) {
        startBackgroundWatchdog();
      }
    }
  });

  if (Platform.OS !== 'web' && !isRunningInExpoGo()) {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
      if (!isRegistered) {
        await BackgroundFetch.registerTaskAsync(BACKGROUND_TASK_NAME, {
          minimumInterval: 15 * 60,
          stopOnTerminate: false,
          startOnBoot: true,
        });
      }
    } catch {}
  }
}
