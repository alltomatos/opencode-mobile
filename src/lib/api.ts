import { fetch } from 'expo/fetch';

import type { ServerConnection } from './servers';

// Subconjunto do tipo real (packages/sdk/js/src/v2/gen/types.gen.ts no
// repo do fork) — só os campos que o app mobile usa até agora.
export type Session = {
  id: string;
  title: string;
  directory: string;
  time: {
    created: number;
    updated: number;
  };
};

export type SessionEvent =
  | { type: 'session.created'; properties: { sessionID: string; info: Session } }
  | { type: 'session.updated'; properties: { sessionID: string; info: Session } }
  | { type: 'session.deleted'; properties: { sessionID: string; info: Session } }
  // Qualquer outro tipo de evento do fork (message.*, permission.*, etc.)
  // — o app ignora por enquanto, mas não deve quebrar ao recebê-los.
  | { type: string; properties?: unknown };

function authedUrl(server: ServerConnection, token: string, path: string): string {
  const url = new URL(path, server.url);
  url.searchParams.set('auth_token', token);
  return url.toString();
}

export async function listSessions(server: ServerConnection, token: string): Promise<Session[]> {
  const res = await fetch(authedUrl(server, token, '/session'));
  if (!res.ok) {
    throw new Error(`GET /session falhou: ${res.status}`);
  }
  return (await res.json()) as Session[];
}

// Parser mínimo de Server-Sent Events sobre o streaming reader do
// `expo/fetch` (docs.expo.dev/versions/latest/sdk/expo — seção
// "Streaming Fetch"). Sem lib externa: são poucas linhas e evita mais
// uma dependência nativa só pra isso.
export async function* subscribeEvents(
  server: ServerConnection,
  token: string,
  signal: AbortSignal
): AsyncGenerator<SessionEvent> {
  const res = await fetch(authedUrl(server, token, '/event'), { signal });
  if (!res.ok || !res.body) {
    throw new Error(`GET /event falhou: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });

      let separatorIndex: number;
      while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);

        const dataLines = rawEvent
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim());
        if (dataLines.length === 0) continue;

        try {
          yield JSON.parse(dataLines.join('\n')) as SessionEvent;
        } catch {
          // Linha de keep-alive ou payload não-JSON — ignora.
        }
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}
