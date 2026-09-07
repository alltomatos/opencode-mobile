import { fetch } from 'expo/fetch';

import { basename, normalizePathKey } from './paths';
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

// `synthetic: true` marca texto injetado pelo servidor ao expandir um
// comando/skill (packages/opencode/src/session/prompt.ts,
// SessionPrompt.command) — não o que o usuário realmente digitou.
// Confirmado ao vivo: rodar POST /session/:id/command sem argumentos
// gera uma mensagem de usuário cuja ÚNICA parte de texto é o corpo
// inteiro da skill, já com `synthetic: true`. O desktop
// (session-ui/message-part.tsx, UserMessageDisplay) usa esse campo
// pra nunca mostrar esse texto como se fosse a mensagem do usuário —
// é exatamente esse comportamento que replicamos no textOf() do chat.
export type TextPart = {
  id: string;
  messageID: string;
  type: 'text';
  text: string;
  synthetic?: boolean;
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

export type ServerHealth = { healthy: true; version: string } | { healthy: false };

// GET /global/health — conferido ao vivo contra o servidor (não
// `/health`, que dá 401 sem rota — o real é `/global/health`, definido
// em packages/opencode/src/server/routes/instance/httpapi/groups/
// global.ts). Devolve {healthy:true, version} quando o servidor
// responde normalmente. Timeout curto porque isso é chamado em polling
// (ver useServerHealth em src/lib/serverHealth.ts) — uma tentativa que
// trava não pode segurar a próxima rodada de verificação.
export async function checkServerHealth(server: ServerConnection, token: string, timeoutMs = 5000): Promise<ServerHealth> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(authedUrl(server, token, '/global/health'), { signal: controller.signal });
    if (!res.ok) return { healthy: false };
    const body = (await res.json()) as { healthy?: boolean; version?: string };
    if (!body.healthy) return { healthy: false };
    return { healthy: true, version: body.version ?? '?' };
  } catch {
    return { healthy: false };
  } finally {
    clearTimeout(timer);
  }
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

// Lista as subpastas de qualquer diretório absoluto via GET /file — o
// endpoint aceita `directory` arbitrário (não só PROJECTS_ROOT), é assim
// que a raiz de importação de projeto (import.tsx) navega o filesystem
// do servidor independente de SO/local. Lança em erro real (pasta não
// existe, sem permissão) — quem chama decide se isso é fatal ou não.
// `timeoutMs`: GET /file não é uma listagem "de graça" — o servidor
// resolve o `directory` como se fosse abrir um projeto ali (git check,
// upsert no banco, ver Project.fromDirectory/instance-store.ts), então
// uma unidade mapeada travada (rede, drive removível) pode pendurar a
// requisição por bastante tempo. Sem limite, um probe de discos
// (listRoots) inteiro trava esperando essa única unidade.
export async function listFolders(
  server: ServerConnection,
  token: string,
  directory: string,
  opts?: { timeoutMs?: number },
): Promise<ProjectFolder[]> {
  const url = new URL('/file', server.url);
  url.searchParams.set('auth_token', token);
  url.searchParams.set('directory', directory);
  url.searchParams.set('path', '.');
  const res = await fetch(url.toString(), opts?.timeoutMs ? { signal: AbortSignal.timeout(opts.timeoutMs) } : undefined);
  if (!res.ok) {
    throw new Error(`GET /file falhou: ${res.status}`);
  }
  const entries = (await res.json()) as { name: string; type: 'file' | 'directory'; absolute: string }[];
  return entries.filter((e) => e.type === 'directory').map((e) => ({ name: e.name, path: e.absolute }));
}

export type DriveRoot = { label: string; path: string };

// Não existe endpoint "liste as unidades/discos" no servidor — a única
// forma de descobrir isso de fora é tentar. "/" é a raiz de verdade em
// POSIX (Linux/macOS) e, no Windows, o Node resolve pra raiz da unidade
// atual do processo do servidor (só uma unidade, não todas). Pra cobrir
// D:\, E:\ etc. também, testamos cada letra de unidade.
//
// Sequencial, NUNCA em paralelo: cada tentativa (mesmo pra uma letra que
// não existe) faz o servidor tratar aquele caminho como abertura de
// projeto de verdade — 26 dessas ao mesmo tempo sobrecarregam o processo
// (contenção no SQLite, spawns de git simultâneos) a ponto dele parar de
// responder ao health check, e o app mostra o servidor como "Offline"
// mesmo com ele "vivo" (visto ao vivo, reportado pelo usuário). Rodar
// uma de cada vez é mais lento, mas mantém o servidor saudável.
export async function listRoots(server: ServerConnection, token: string): Promise<DriveRoot[]> {
  const candidates: DriveRoot[] = [
    { label: '/', path: '/' },
    ...Array.from({ length: 26 }, (_, i) => {
      const letter = String.fromCharCode(65 + i);
      return { label: `${letter}:`, path: `${letter}:\\` };
    }),
  ];
  const roots: DriveRoot[] = [];
  for (const candidate of candidates) {
    try {
      await listFolders(server, token, candidate.path, { timeoutMs: 4000 });
      roots.push(candidate);
    } catch {
      // Não existe, sem permissão, ou demorou demais — pula pro próximo.
    }
  }
  const drives = roots.filter((r) => r.path !== '/');
  return drives.length > 0 ? drives : roots;
}

// Lista as pastas reais dentro de PROJECTS_ROOT. Cobre o caso de uma
// pasta recém-criada pelo app (mkdir/git clone em add.tsx) que ainda não
// foi "aberta" (nenhuma sessão/diretório tocou nela ainda) — GET
// /project só lista o que já passou por Project.fromDirectory, e isso só
// acontece na primeira requisição real contra aquele diretório. Sem
// isso, um projeto recém-criado sumiria da lista até o usuário abrir uma
// sessão nele por fora do app.
export async function listProjectFolders(server: ServerConnection, token: string): Promise<ProjectFolder[]> {
  try {
    return await listFolders(server, token, PROJECTS_ROOT);
  } catch {
    // PROJECTS_ROOT ainda não existe (nenhum projeto criado ainda, ou o
    // servidor nem segue essa convenção — caso do desktop) — lista
    // vazia é a resposta certa, não um erro pro usuário ver.
    return [];
  }
}

// Subconjunto de Project.Info (packages/opencode/src/project/project.ts
// no repo do fork) — só os campos usados pela lista de projetos.
export type ProjectInfo = {
  id: string;
  worktree: string;
  name?: string;
  vcs?: string;
};

// GET /project — "lista todos os projetos já abertos com o OpenCode",
// independente de pasta/diretório (não usa `directory` de query nem
// resolve nada por cima do diretório atual da instância, ver
// packages/opencode/src/server/routes/instance/httpapi/handlers/project.ts
// `list` → `Project.Service.list()` → SELECT * FROM project). É a mesma
// fonte que popula a sidebar "Projetos" do app desktop, então cobre
// projetos em qualquer pasta do disco (D:\dev\Diponera, ~/code/foo,
// etc.) — não só os que vivem sob PROJECTS_ROOT. Requer que o projeto já
// tenha sido tocado por pelo menos uma sessão nessa pasta (git ou não —
// só pastas sem VCS *nenhum* colapsam num projeto "global" único, ver
// Project.fromDirectory).
export async function listProjects(server: ServerConnection, token: string): Promise<ProjectInfo[]> {
  const res = await fetch(authedUrl(server, token, '/project'));
  if (!res.ok) {
    throw new Error(`GET /project falhou: ${res.status}`);
  }
  return (await res.json()) as ProjectInfo[];
}

// Une as duas fontes de projeto disponíveis no servidor: GET /project
// (qualquer pasta que já teve uma sessão aberta, incluindo as do
// desktop fora de PROJECTS_ROOT) e a listagem de pastas em
// PROJECTS_ROOT (cobre pasta recém-criada pelo próprio app, ver
// listProjectFolders). Deduplicadas por caminho absoluto — GET /project
// ganha o nome quando os dois concordam, já que reflete o nome/ícone
// customizado que o usuário deu ao projeto no desktop.
export async function listAllProjects(server: ServerConnection, token: string): Promise<ProjectFolder[]> {
  const [projects, folders] = await Promise.all([
    listProjects(server, token).catch(() => [] as ProjectInfo[]),
    listProjectFolders(server, token).catch(() => [] as ProjectFolder[]),
  ]);

  const byPath = new Map<string, ProjectFolder>();
  for (const project of projects) {
    if (!project.worktree || project.worktree === '/') continue;
    byPath.set(normalizePathKey(project.worktree), {
      name: project.name || basename(project.worktree),
      path: project.worktree,
    });
  }
  for (const folder of folders) {
    const key = normalizePathKey(folder.path);
    if (!byPath.has(key)) byPath.set(key, folder);
  }

  return [...byPath.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// `directory` não é opcional na prática: sem ele, o servidor resolve
// `ctx.project` a partir do próprio diretório padrão da instância (visto
// ao vivo — GET /session sem query devolvia só sessões de
// /home/opencode/app, nunca as de outros projetos) e a lista some por
// completo pro projeto que o usuário está olhando. Conferido em
// packages/opencode/src/server/routes/instance/httpapi/handlers/session.ts
// (list) + packages/opencode/src/session/session.ts (list faz
// listByProject com ctx.project.id, escopado pelo directory resolvido).
export async function listSessions(server: ServerConnection, token: string, directory: string): Promise<Session[]> {
  const url = new URL('/session', server.url);
  url.searchParams.set('auth_token', token);
  url.searchParams.set('directory', directory);
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`GET /session falhou: ${res.status}`);
  }
  return (await res.json()) as Session[];
}

// GET /session/status — snapshot atual (id → busy/idle/retry) de TODAS
// as sessões, não só de uma. Usado pra pintar o indicador "trabalhando"
// na lista de sessões assim que a tela abre — sem isso, só dava pra
// saber quem está rodando observando eventos SSE ao vivo dali em diante,
// perdendo o estado de qualquer turno que já estava em andamento antes
// da tela ser aberta.
export async function getSessionStatusMap(server: ServerConnection, token: string): Promise<Record<string, SessionStatus>> {
  const res = await fetch(authedUrl(server, token, '/session/status'));
  if (!res.ok) {
    throw new Error(`GET /session/status falhou: ${res.status}`);
  }
  return (await res.json()) as Record<string, SessionStatus>;
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

// DELETE /session/:id — conferido em
// packages/opencode/src/session/session.ts (remove): apaga em cascata
// as sessões filhas (subagents) primeiro, depois a sessão em si —
// mensagens e partes junto (a doc da rota diz literalmente "permanently
// remove all associated data, including messages and history"). Não
// tem confirmação nenhuma do lado do servidor; quem decide se confirma
// com o usuário antes é o app.
export async function deleteSession(
  server: ServerConnection,
  token: string,
  sessionID: string,
  directory: string
): Promise<void> {
  const url = new URL(`/session/${sessionID}`, server.url);
  url.searchParams.set('auth_token', token);
  url.searchParams.set('directory', directory);
  const res = await fetch(url.toString(), { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(`DELETE /session/${sessionID} falhou: ${await errorDetail(res)}`);
  }
}

// PATCH /session/:id — conferido em
// packages/opencode/src/server/routes/instance/httpapi/groups/session.ts
// (UpdatePayload): `title` é o único campo que usamos aqui (também
// aceita metadata/permission/time.archived, não usados no app).
export async function renameSession(
  server: ServerConnection,
  token: string,
  sessionID: string,
  directory: string,
  title: string
): Promise<Session> {
  const url = new URL(`/session/${sessionID}`, server.url);
  url.searchParams.set('auth_token', token);
  url.searchParams.set('directory', directory);
  const res = await fetch(url.toString(), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    throw new Error(`PATCH /session/${sessionID} falhou: ${await errorDetail(res)}`);
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

// POST /session/:id/prompt_async — dispara o turno do agente e volta na
// hora (204, sem corpo). Diferença crucial pra `sendPrompt` (síncrona):
// no fork, o handler faz `Effect.forkIn(scope, ...)` usando o escopo do
// PRÓPRIO SERVIDOR, não o da requisição HTTP (ver
// packages/opencode/src/server/routes/instance/httpapi/handlers/
// session.ts, promptAsync) — o turno roda desacoplado da conexão. Com
// `sendPrompt`, fechar o app/a conexão cair no meio da resposta
// interrompe o processamento no servidor junto (reportado ao vivo:
// fechar o app parava a conversa); com prompt_async ele continua rodando
// e o app só acompanha via SSE (message.part.updated/session.status),
// reconciliando o que perdeu ao reabrir a tela.
export async function sendPromptAsync(
  server: ServerConnection,
  token: string,
  sessionID: string,
  text: string,
  agent?: string,
  model?: SelectedModel
): Promise<void> {
  const res = await fetch(authedUrl(server, token, `/session/${sessionID}/prompt_async`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parts: [{ type: 'text', text }],
      ...(agent ? { agent } : {}),
      ...(model ? { model: { modelID: model.modelID, providerID: model.providerID } } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`POST /session/${sessionID}/prompt_async falhou: ${await errorDetail(res)}`);
  }
}

// POST /session/:id/message (síncrona — segura a conexão até a resposta
// completar). Ainda usada por dispatchCommand (comandos são rápidos, não
// turnos longos de agente) — mensagens de texto normais usam
// sendPromptAsync acima.
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

// Ancora comandos avulsos (mkdir/git clone/rm) numa sessão descartável
// em /home/opencode — mesmo mecanismo do bootstrap em
// app/server/[id]/code/add.tsx, centralizado aqui pra reusar também no
// apagar-projeto. POST /session/:id/shell responde 200 mesmo quando o
// comando falha (ver fork-map.md), então o marcador `&&` no fim é
// obrigatório pra saber se deu certo de verdade.
const BOOTSTRAP_DIRECTORY = '/home/opencode';

export async function runManagedShell(server: ServerConnection, token: string, command: string): Promise<string> {
  const bootstrap = await createSession(server, token, BOOTSTRAP_DIRECTORY);
  const OK_MARKER = '___OPENCODE_MOBILE_OK___';
  const result = await runShell(server, token, bootstrap.id, `${command} && echo ${OK_MARKER}`);
  const output = extractOutput(result);
  if (!output.includes(OK_MARKER)) {
    throw new Error(output.trim() || 'O comando não terminou como esperado.');
  }
  return output;
}

// Não existe rota de servidor pra apagar um projeto/pasta (conferido
// em packages/opencode/src/server/routes/instance/httpapi/groups/
// project.ts — só GET/PATCH, nenhum DELETE) — a única forma real é
// `rm -rf` via shell. Apaga também o histórico de sessões daquele
// diretório (senão ficam sessões órfãs apontando pra uma pasta que não
// existe mais), então quem chama deve ter a lista de sessões da pasta
// primeiro e passar os ids aqui.
export async function deleteProjectFolder(
  server: ServerConnection,
  token: string,
  directory: string,
  sessionIDs: string[]
): Promise<void> {
  for (const id of sessionIDs) {
    await deleteSession(server, token, id, directory).catch(() => {});
  }
  await runManagedShell(server, token, `rm -rf "${directory}"`);
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

// Sistema de memória (packages/opencode/src/memory/index.ts) — guarda
// arquivos markdown em disco (global ou por projeto), NÃO tem API HTTP
// pra listar/ver entradas individuais (confirmado: só o servidor lê via
// as tools memory_search/memory_save). A API só permite: ligar/desligar
// globalmente, checar "esse projeto tem memória?" e apagar tudo daquele
// projeto de uma vez — mesmas rotas usadas pelo desktop
// (settings-v2/memory.tsx e dialog-forget-project-memory.tsx).
export type MemoryConfig = {
  enabled?: boolean;
  memoryModel?: string;
};

export async function getMemoryConfig(server: ServerConnection, token: string): Promise<MemoryConfig> {
  const res = await fetch(authedUrl(server, token, '/memory'));
  if (!res.ok) {
    throw new Error(`GET /memory falhou: ${res.status}`);
  }
  return (await res.json()) as MemoryConfig;
}

export async function setMemoryConfig(
  server: ServerConnection,
  token: string,
  config: MemoryConfig
): Promise<void> {
  const res = await fetch(authedUrl(server, token, '/memory'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    throw new Error(`PUT /memory falhou: ${await errorDetail(res)}`);
  }
}

export async function getProjectMemoryStatus(
  server: ServerConnection,
  token: string,
  directory: string
): Promise<boolean> {
  const url = new URL('/memory/project', server.url);
  url.searchParams.set('auth_token', token);
  url.searchParams.set('directory', directory);
  const res = await fetch(url.toString());
  if (!res.ok) return false;
  const body = (await res.json()) as { hasMemory?: boolean };
  return !!body.hasMemory;
}

export async function deleteProjectMemory(
  server: ServerConnection,
  token: string,
  directory: string
): Promise<void> {
  const url = new URL('/memory/project', server.url);
  url.searchParams.set('auth_token', token);
  url.searchParams.set('directory', directory);
  const res = await fetch(url.toString(), { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(`DELETE /memory/project falhou: ${res.status}`);
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
