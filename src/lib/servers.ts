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

// Valida o servidor (GET /instance) antes de salvar — ver
// docs/prd/mobile-api-reference.md §4.3, passo 2.
export async function verifyServer(url: string, token: string): Promise<boolean> {
  const endpoint = new URL('/instance', url);
  endpoint.searchParams.set('auth_token', token);
  try {
    const res = await fetch(endpoint.toString());
    return res.ok;
  } catch {
    return false;
  }
}

export async function addServer(payload: PairingPayload): Promise<ServerConnection> {
  const server: ServerConnection = {
    id: crypto.randomUUID(),
    url: payload.url,
    label: payload.label ?? new URL(payload.url).host,
  };
  const servers = await readManifest();
  await writeManifest([...servers, server]);
  await SecureStore.setItemAsync(tokenKey(server.id), payload.token);
  return server;
}

export async function removeServer(id: string): Promise<void> {
  const servers = await readManifest();
  await writeManifest(servers.filter((s) => s.id !== id));
  await SecureStore.deleteItemAsync(tokenKey(id));
}
