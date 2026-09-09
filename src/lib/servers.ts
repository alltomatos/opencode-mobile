import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

// Um servidor pareado (docs/prd/mobile-api-reference.md §3-4). Fase 1 só
// suporta o tipo `http` — VPS, Tailscale ou rede local.
export type ServerConnection = {
  id: string;
  url: string;
  label: string;
};

const MANIFEST_KEY = 'opencode-servers';

function tokenKey(id: string) {
  return `opencode-server-token-${id}`;
}

// O manifesto guarda só metadados (sem credencial) para ficar bem abaixo
// do limite histórico de ~2048 bytes do SecureStore em cada valor — o
// token de cada servidor fica numa chave própria.
async function readManifest(): Promise<ServerConnection[]> {
  const raw = await SecureStore.getItemAsync(MANIFEST_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as ServerConnection[];
}

async function writeManifest(servers: ServerConnection[]) {
  await SecureStore.setItemAsync(MANIFEST_KEY, JSON.stringify(servers));
}

export async function listServers(): Promise<ServerConnection[]> {
  return readManifest();
}

export async function getServerToken(id: string): Promise<string | null> {
  return SecureStore.getItemAsync(tokenKey(id));
}

// Payload do QR code de pareamento (docs/prd/mobile-api-reference.md §4.1).
export type PairingPayload = {
  v: 1;
  url: string;
  token: string;
  label?: string;
};

export function parsePairingPayload(raw: string): PairingPayload {
  const parsed = JSON.parse(raw);
  if (parsed.v !== 1 || typeof parsed.url !== 'string' || typeof parsed.token !== 'string') {
    throw new Error('Payload de pareamento inválido');
  }
  return parsed as PairingPayload;
}

// Valida o servidor antes de salvar — ver docs/prd/mobile-api-reference.md
// §4.3, passo 2. Era GET /instance, mas essa rota não existe na API real
// (o grupo "instance" só tem /instance/dispose, /path, /vcs etc. — GET
// /instance sozinho caía no fallback do SPA do servidor, devolvendo o
// HTML da página web com 200 OK, então "funcionava" por acidente até a
// versão do servidor mudar o fallback). GET /global/health é a rota
// certa, já usada em checkServerHealth (src/lib/api.ts) e confirmada ao
// vivo contra o servidor. Timeout curto pra não travar o pareamento
// numa rede lenta/relay do Tailscale sem dar feedback nenhum.
export async function verifyServer(url: string, token: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const endpoint = new URL('/global/health', url);
  endpoint.searchParams.set('auth_token', token);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(endpoint.toString(), { signal: controller.signal });
    if (!res.ok) {
      return { ok: false, reason: `Servidor respondeu ${res.status} (${res.statusText || 'erro'})` };
    }
    const body = (await res.json().catch(() => null)) as { healthy?: boolean } | null;
    if (body && body.healthy === false) {
      return { ok: false, reason: 'Servidor respondeu, mas reportou não estar saudável.' };
    }
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return { ok: false, reason: 'Servidor não respondeu a tempo (timeout de 8s).' };
    }
    return { ok: false, reason: e instanceof Error ? e.message : 'Falha de rede desconhecida.' };
  } finally {
    clearTimeout(timer);
  }
}

export async function addServer(payload: PairingPayload): Promise<ServerConnection> {
  const server: ServerConnection = {
    id: Crypto.randomUUID(),
    url: payload.url,
    label: payload.label ?? new URL(payload.url).host,
  };
  const servers = await readManifest();
  await writeManifest([...servers, server]);
  await SecureStore.setItemAsync(tokenKey(server.id), payload.token);
  return server;
}

// Não existe um campo "tipo de conexão" no protocolo — o desktop
// (packages/app/src/context/server.tsx) também não deriva isso
// automaticamente, é só texto livre que a pessoa digita no label.
// Aqui detectamos pelo próprio host da URL, já que é informação
// grátis e ajuda a diferenciar "mesmo servidor, caminho diferente"
// (ex.: a mesma VPS acessada via Tailscale ou via IP público) sem
// depender do usuário lembrar de anotar isso no nome.
export function describeConnection(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return 'Desconhecida';
  }

  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return 'Local';
  if (host.endsWith('.ts.net')) return 'Tailscale';

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = ipv4.slice(1).map(Number);
    // CGNAT 100.64.0.0/10 — faixa que o Tailscale usa pros IPs "100.x".
    if (a === 100 && b >= 64 && b <= 127) return 'Tailscale';
    if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return 'Rede local';
  }

  return 'Internet';
}

export async function updateServer(id: string, patch: { label?: string; url?: string }): Promise<void> {
  const servers = await readManifest();
  await writeManifest(servers.map((s) => (s.id === id ? { ...s, ...patch } : s)));
}

// Só usado quando o usuário troca o token na edição do servidor (ex.:
// o desktop gerou um token novo) — trocar a URL/label não mexe nisso.
export async function updateServerToken(id: string, token: string): Promise<void> {
  await SecureStore.setItemAsync(tokenKey(id), token);
}

export async function removeServer(id: string): Promise<void> {
  const servers = await readManifest();
  await writeManifest(servers.filter((s) => s.id !== id));
  await SecureStore.deleteItemAsync(tokenKey(id));
}
