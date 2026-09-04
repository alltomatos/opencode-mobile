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

// Subconjunto de UserMessage | AssistantMessage — só os campos usados
// pela tela de chat.
export type Message = {
  id: string;
  sessionID: string;
  role: 'user' | 'assistant';
  time: {
    created: number;
    completed?: number;
  };
};

// TextPart é o único tipo de parte que o app renderiza por enquanto;
// os outros (tool, reasoning, file, etc.) passam pelo formato genérico
// abaixo pra não quebrar ao receber algo que ainda não sabe desenhar.
export type TextPart = {
  id: string;
  messageID: string;
  type: 'text';
  text: string;
};

export type Part = TextPart | { id: string; messageID: string; type: string };

export type MessageWithParts = {
  info: Message;
  parts: Part[];
};

export type SessionEvent =
  | { type: 'session.created'; properties: { sessionID: string; info: Session } }
  | { type: 'session.updated'; properties: { sessionID: string; info: Session } }
  | { type: 'session.deleted'; properties: { sessionID: string; info: Session } }
  | { type: 'message.updated'; properties: { sessionID: string; info: Message } }
  | { type: 'message.part.updated'; properties: { sessionID: string; part: Part } }
  // Qualquer outro tipo de evento do fork (permission.*, etc.) — o app
  // ignora por enquanto, mas não deve quebrar ao recebê-los.
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

export async function getSession(server: ServerConnection, token: string, sessionID: string): Promise<Session> {
  const res = await fetch(authedUrl(server, token, `/session/${sessionID}`));
  if (!res.ok) {
    throw new Error(`GET /session/${sessionID} falhou: ${res.status}`);
  }
  return (await res.json()) as Session;
}

export async function listMessages(
  server: ServerConnection,
  token: string,
  sessionID: string
): Promise<MessageWithParts[]> {
  const res = await fetch(authedUrl(server, token, `/session/${sessionID}/message`));
  if (!res.ok) {
    throw new Error(`GET /session/${sessionID}/message falhou: ${res.status}`);
  }
  return (await res.json()) as MessageWithParts[];
}

// POST /session/:id/message (síncrono — segura a conexão até a resposta
// completar). docs/prd/mobile-api-reference.md §5.1 sugere prompt_async
// pra não travar a UI numa conexão HTTP longa; fica pra quando a tela
// precisar de progresso incremental via SSE em vez de aguardar aqui.
export async function sendPrompt(
  server: ServerConnection,
  token: string,
  sessionID: string,
  text: string
): Promise<MessageWithParts> {
  const res = await fetch(authedUrl(server, token, `/session/${sessionID}/message`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parts: [{ type: 'text', text }] }),
  });
  if (!res.ok) {
    throw new Error(`POST /session/${sessionID}/message falhou: ${res.status}`);
  }
  return (await res.json()) as MessageWithParts;
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
