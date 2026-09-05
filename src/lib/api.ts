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

// Raiz padrão onde este app cria/espera projetos (convenção do app
// mobile, não do servidor — ver docs/prd/mobile-app.md §5.1).
export const PROJECTS_ROOT = '/home/opencode/projects';

export type ProjectFolder = {
  name: string;
  path: string;
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

export type TextPart = {
  id: string;
  messageID: string;
  type: 'text';
  text: string;
};

// Conferido contra packages/sdk/js/src/v2/gen/types.gen.ts no fork.
export type ReasoningPart = {
  id: string;
  messageID: string;
  type: 'reasoning';
  text: string;
  time: { start: number; end?: number };
};

// tool = id real da ferramenta no servidor — conferido lendo
// packages/opencode/src/tool/*.ts (cada arquivo chama Tool.define com
// esse literal): shell.ts usa "bash" (não "shell"!), apply_patch.ts
// usa "apply_patch", todo.ts usa "todowrite", memory-search/save.ts
// usam "memory_search"/"memory_save", websearch.ts usa "websearch".
// Os demais (read, write, edit, glob, grep, task, webfetch, skill,
// question, lsp, plan_exit, browser, computer) usam o próprio nome do
// arquivo/conceito como id.
export type ToolPart = {
  id: string;
  messageID: string;
  type: 'tool';
  tool: string;
  callID: string;
  state: {
    status: 'pending' | 'running' | 'completed' | 'error';
    input?: unknown;
    title?: string;
    output?: string;
    error?: string;
    time?: { start: number; end?: number };
  };
};

export type StepPart = {
  id: string;
  messageID: string;
  type: 'step-start' | 'step-finish';
};

export type Part =
  | TextPart
  | ReasoningPart
  | ToolPart
  | StepPart
  | { id: string; messageID: string; type: string };

export type MessageWithParts = {
  info: Message;
  parts: Part[];
};

// Junta o texto visível de uma mensagem — partes de texto, mais saída
// (ou erro) de partes de tool completadas/com erro (shell, etc.). Usa
// isso pra decidir se um comando via runShell() realmente deu certo:
// o endpoint HTTP responde 200 mesmo quando o comando de shell falha
// (ex.: `git clone` de repo privado) — só o conteúdo da parte de tool
// revela o resultado real.
export function extractOutput(message: MessageWithParts): string {
  return message.parts
    .map((p) => {
      if (p.type === 'text') return (p as TextPart).text;
      const state = (p as { type: string; state?: { status?: string; output?: string; error?: string } }).state;
      if (state?.status === 'completed') return state.output ?? '';
      if (state?.status === 'error') return state.error ?? '';
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

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

// GET /provider — conferido contra a resposta real do SDK
// (ProviderListResponses: {all, default, connected}).
export type Model = {
  id: string;
  providerID: string;
  name: string;
};

export type Provider = {
  id: string;
  name: string;
  models: Record<string, Model>;
};

export type ProviderList = {
  all: Provider[];
  default: Record<string, string>;
  connected: string[];
};

export type SelectedModel = {
  providerID: string;
  modelID: string;
};

// GET /command — unifica comandos de skill, MCP e comandos normais
// (source: "command"|"mcp"|"skill") num só catálogo. É o que
// alimenta o autocomplete de "/" no composer.
export type Command = {
  name: string;
  description?: string;
  source?: 'command' | 'mcp' | 'skill';
};

// Conferido contra packages/schema/src/session-status-event.ts. "busy"
// e "idle" o app não precisa mostrar (o indicador de tool/reasoning já
// cobre "trabalhando"); "retry" é o único que precisa de UI própria —
// um card inline (não um badge de header) com a mensagem de erro e a
// tentativa atual, igual ao desktop (session-retry.tsx).
export type SessionStatus =
  | { type: 'idle' }
  | { type: 'busy' }
  | { type: 'retry'; attempt: number; message: string; next: number };

export type SessionEvent =
  | { type: 'session.created'; properties: { sessionID: string; info: Session } }
  | { type: 'session.updated'; properties: { sessionID: string; info: Session } }
  | { type: 'session.deleted'; properties: { sessionID: string; info: Session } }
  | { type: 'session.status'; properties: { sessionID: string; status: SessionStatus } }
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

// Erros do fork vêm como JSON ({name, data: {message}}) — mostrar só
// o status HTTP escondia a causa real (ex.: "Missing key at
// [\"model\"][\"modelID\"]"), o que tornou um bug de nome de campo
// difícil de diagnosticar até testar contra o servidor na mão.
async function errorDetail(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body?.data?.message || body?.message || JSON.stringify(body);
  } catch {
    return res.statusText;
  }
}

function authedUrl(server: ServerConnection, token: string, path: string): string {
  const url = new URL(path, server.url);
  url.searchParams.set('auth_token', token);
  return url.toString();
}

export async function listCommands(server: ServerConnection, token: string): Promise<Command[]> {
  const res = await fetch(authedUrl(server, token, '/command'));
  if (!res.ok) {
    throw new Error(`GET /command falhou: ${await errorDetail(res)}`);
  }
  return (await res.json()) as Command[];
}

// POST /session/:id/command — conferido contra
// packages/opencode/src/session/prompt.ts (CommandInput): `command` e
// `arguments` são obrigatórios (arguments pode ser string vazia).
export async function runCommand(
  server: ServerConnection,
  token: string,
  sessionID: string,
  command: string,
  args: string
): Promise<MessageWithParts> {
  const res = await fetch(authedUrl(server, token, `/session/${sessionID}/command`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, arguments: args }),
  });
  if (!res.ok) {
    throw new Error(`POST /session/${sessionID}/command falhou: ${await errorDetail(res)}`);
  }
  return (await res.json()) as MessageWithParts;
}

export async function listProviders(server: ServerConnection, token: string): Promise<ProviderList> {
  const res = await fetch(authedUrl(server, token, '/provider'));
  if (!res.ok) {
    throw new Error(`GET /provider falhou: ${res.status}`);
  }
  return (await res.json()) as ProviderList;
}

export async function listAgents(server: ServerConnection, token: string): Promise<Agent[]> {
  const res = await fetch(authedUrl(server, token, '/agent'));
  if (!res.ok) {
    throw new Error(`GET /agent falhou: ${res.status}`);
  }
  return (await res.json()) as Agent[];
}

// Lista as pastas reais dentro de PROJECTS_ROOT via GET /file, em vez
// de GET /project. Motivo: a resolução de "diretório → projeto" do
// servidor só reconhece pastas com git (e mesmo assim é cacheada pra
// sempre por diretório — ver docs/prd/mobile-api-reference.md e o
// commit que corrigiu isso). Um projeto sem git nunca apareceria em
// GET /project, mas o usuário pode legitimamente ter um. Listar
// direto o filesystem não depende de nenhuma dessas resoluções — só
// da pasta existir. Agrupamos sessões por `directory` (string), não
// por id de projeto, então isso não perde nada pro resto do app.
export async function listProjectFolders(server: ServerConnection, token: string): Promise<ProjectFolder[]> {
  const url = new URL('/file', server.url);
  url.searchParams.set('auth_token', token);
  url.searchParams.set('directory', PROJECTS_ROOT);
  url.searchParams.set('path', '.');
  const res = await fetch(url.toString());
  if (!res.ok) {
    // PROJECTS_ROOT ainda não existe (nenhum projeto criado ainda) —
    // lista vazia é a resposta certa, não um erro pro usuário ver.
    return [];
  }
  const entries = (await res.json()) as { name: string; type: 'file' | 'directory'; absolute: string }[];
  return entries.filter((e) => e.type === 'directory').map((e) => ({ name: e.name, path: e.absolute }));
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
    throw new Error(`POST /session falhou: ${await errorDetail(res)}`);
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
  agent?: string,
  model?: SelectedModel
): Promise<MessageWithParts> {
  const res = await fetch(authedUrl(server, token, `/session/${sessionID}/message`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parts: [{ type: 'text', text }],
      ...(agent ? { agent } : {}),
      // Testado direto contra o servidor: o campo é `modelID`, não
      // `id` como uma pesquisa anterior (baseada no código do
      // desktop) tinha indicado — POST real devolvia
      // `Missing key at ["model"]["modelID"]` até essa correção.
      ...(model ? { model: { modelID: model.modelID, providerID: model.providerID } } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`POST /session/${sessionID}/message falhou: ${await errorDetail(res)}`);
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
    throw new Error(`POST /session/${sessionID}/shell falhou: ${await errorDetail(res)}`);
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
