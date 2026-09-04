import { fetch } from 'expo/fetch';

import type { ServerConnection } from './servers';

// Subconjunto do tipo real (packages/sdk/js/src/v2/gen/types.gen.ts no
// repo do fork) — só os campos que o app mobile usa até agora.
export type Session = {
  id: string;
  title: string;
  directory: string;
  parentID?: string;
  time: {
    created: number;
    updated: number;
  };
};

// GET /project — o campo do caminho da pasta é `worktree`, não
// `directory` (conferido contra packages/schema/src/project.ts).
export type Project = {
  id: string;
  worktree: string;
  name?: string;
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

// Conferido contra packages/schema/src/v1/{permission,question}.ts no
// repo do fork — são as rotas "v1" ativas (/permission, /question);
// existe também um schema "v2" em desenvolvimento que este app não usa.
export type PermissionRequest = {
  id: string;
  sessionID: string;
  permission: string;
  patterns: string[];
  tool?: { messageID: string; callID: string };
};

export type PermissionReply = 'once' | 'always' | 'reject';

export type QuestionOption = {
  label: string;
  description: string;
};

export type QuestionInfo = {
  question: string;
  header: string;
  options: QuestionOption[];
  multiple?: boolean;
  custom?: boolean;
};

export type QuestionRequest = {
  id: string;
  sessionID: string;
  questions: QuestionInfo[];
};

// GET /agent — conferido contra packages/opencode/src/agent/agent.ts.
// "build" e "plan" são os agentes nativos; "plan" nega ferramentas de
// edição (é o que dá o modo "Planejar" de verdade — ver
// docs/prd/mobile-app.md §6.1, item 3).
export type Agent = {
  name: string;
  description?: string;
  mode: 'subagent' | 'primary' | 'all';
  native?: boolean;
};

export type SessionEvent =
  | { type: 'session.created'; properties: { sessionID: string; info: Session } }
  | { type: 'session.updated'; properties: { sessionID: string; info: Session } }
  | { type: 'session.deleted'; properties: { sessionID: string; info: Session } }
  | { type: 'message.updated'; properties: { sessionID: string; info: Message } }
  | { type: 'message.part.updated'; properties: { sessionID: string; part: Part } }
  | { type: 'permission.asked'; properties: PermissionRequest }
  | { type: 'permission.replied'; properties: { sessionID: string; requestID: string } }
  | { type: 'question.asked'; properties: QuestionRequest }
  | { type: 'question.replied'; properties: { sessionID: string; requestID: string } }
  | { type: 'question.rejected'; properties: { sessionID: string; requestID: string } }
  // Qualquer outro tipo de evento do fork (mcp.*, project.*, etc.) — o
  // app ignora por enquanto, mas não deve quebrar ao recebê-los.
  | { type: string; properties?: unknown };

function authedUrl(server: ServerConnection, token: string, path: string): string {
  const url = new URL(path, server.url);
  url.searchParams.set('auth_token', token);
  return url.toString();
}

export async function listAgents(server: ServerConnection, token: string): Promise<Agent[]> {
  const res = await fetch(authedUrl(server, token, '/agent'));
  if (!res.ok) {
    throw new Error(`GET /agent falhou: ${res.status}`);
  }
  return (await res.json()) as Agent[];
}

export async function listProjects(server: ServerConnection, token: string): Promise<Project[]> {
  const res = await fetch(authedUrl(server, token, '/project'));
  if (!res.ok) {
    throw new Error(`GET /project falhou: ${res.status}`);
  }
  return (await res.json()) as Project[];
}

// "Adicionar projeto" não é um endpoint dedicado — GET /project (a
// doc chama de "list of projects that have been opened") mostra que
// um projeto vira conhecido do servidor simplesmente por alguém
// apontar `directory` numa chamada roteada por workspace (mesmo
// WorkspaceRoutingMiddleware de toda a API). GET /project/current com
// o novo `directory` é a chamada mínima que "abre" um projeto novo.
export async function openProject(server: ServerConnection, token: string, directory: string): Promise<Project> {
  const url = new URL('/project/current', server.url);
  url.searchParams.set('auth_token', token);
  url.searchParams.set('directory', directory);
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`GET /project/current falhou: ${res.status}`);
  }
  return (await res.json()) as Project;
}

export async function listSessions(server: ServerConnection, token: string): Promise<Session[]> {
  const res = await fetch(authedUrl(server, token, '/session'));
  if (!res.ok) {
    throw new Error(`GET /session falhou: ${res.status}`);
  }
  return (await res.json()) as Session[];
}

// POST /session — a rota v1 ativa recebe `directory` como query param
// (mesmo padrão de WorkspaceRoutingQuery usado em toda a API), não no
// corpo — existe uma rota /api/session (v2) separada que usa
// body.location.directory, mas essa é outra superfície que este app
// não usa (mobile-api-reference.md documenta as rotas v1 como as
// ativas — /session, /permission, /question).
export async function createSession(
  server: ServerConnection,
  token: string,
  directory: string,
  agent?: string
): Promise<Session> {
  const url = new URL('/session', server.url);
  url.searchParams.set('auth_token', token);
  url.searchParams.set('directory', directory);
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(agent ? { agent } : {}),
  });
  if (!res.ok) {
    throw new Error(`POST /session falhou: ${res.status}`);
  }
  return (await res.json()) as Session;
}

// GET /session/:id/children — sessões filhas (subagents), criadas
// automaticamente pela tool `task` quando o agente delega trabalho
// (packages/opencode/src/tool/task.ts). Não é algo que o usuário
// dispara manualmente.
export async function listChildren(server: ServerConnection, token: string, sessionID: string): Promise<Session[]> {
  const res = await fetch(authedUrl(server, token, `/session/${sessionID}/children`));
  if (!res.ok) {
    throw new Error(`GET /session/${sessionID}/children falhou: ${res.status}`);
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
  text: string,
  agent?: string
): Promise<MessageWithParts> {
  const res = await fetch(authedUrl(server, token, `/session/${sessionID}/message`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parts: [{ type: 'text', text }], ...(agent ? { agent } : {}) }),
  });
  if (!res.ok) {
    throw new Error(`POST /session/${sessionID}/message falhou: ${res.status}`);
  }
  return (await res.json()) as MessageWithParts;
}

// POST /session/:id/shell — conferido contra
// packages/opencode/src/session/prompt.ts (ShellInput): `agent` é
// obrigatório (não opcional como no /message), `command` é a linha de
// shell crua. Usado só pra bootstrap de projeto (mkdir/git clone) —
// não é uma feature de terminal geral no app ainda.
export async function runShell(
  server: ServerConnection,
  token: string,
  sessionID: string,
  command: string,
  agent: string = 'build'
): Promise<MessageWithParts> {
  const res = await fetch(authedUrl(server, token, `/session/${sessionID}/shell`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent, command }),
  });
  if (!res.ok) {
    throw new Error(`POST /session/${sessionID}/shell falhou: ${res.status}`);
  }
  return (await res.json()) as MessageWithParts;
}

export async function listPermissions(server: ServerConnection, token: string): Promise<PermissionRequest[]> {
  const res = await fetch(authedUrl(server, token, '/permission'));
  if (!res.ok) {
    throw new Error(`GET /permission falhou: ${res.status}`);
  }
  return (await res.json()) as PermissionRequest[];
}

export async function listQuestions(server: ServerConnection, token: string): Promise<QuestionRequest[]> {
  const res = await fetch(authedUrl(server, token, '/question'));
  if (!res.ok) {
    throw new Error(`GET /question falhou: ${res.status}`);
  }
  return (await res.json()) as QuestionRequest[];
}

export async function replyPermission(
  server: ServerConnection,
  token: string,
  requestID: string,
  reply: PermissionReply
): Promise<void> {
  const res = await fetch(authedUrl(server, token, `/permission/${requestID}/reply`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reply }),
  });
  if (!res.ok) {
    throw new Error(`POST /permission/${requestID}/reply falhou: ${res.status}`);
  }
}

// `answers` segue a mesma ordem de `QuestionRequest.questions` — uma
// entrada por pergunta, cada uma com os labels selecionados.
export async function replyQuestion(
  server: ServerConnection,
  token: string,
  requestID: string,
  answers: string[][]
): Promise<void> {
  const res = await fetch(authedUrl(server, token, `/question/${requestID}/reply`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  });
  if (!res.ok) {
    throw new Error(`POST /question/${requestID}/reply falhou: ${res.status}`);
  }
}

export async function rejectQuestion(server: ServerConnection, token: string, requestID: string): Promise<void> {
  const res = await fetch(authedUrl(server, token, `/question/${requestID}/reject`), { method: 'POST' });
  if (!res.ok) {
    throw new Error(`POST /question/${requestID}/reject falhou: ${res.status}`);
  }
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
