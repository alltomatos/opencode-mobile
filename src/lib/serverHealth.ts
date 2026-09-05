import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { checkServerHealth, ServerHealth } from './api';
import { getServerToken, ServerConnection } from './servers';

// Mesmo intervalo do desktop (HEALTH_POLL_INTERVAL_MS em
// packages/app/src/context/server.tsx) — polling simples de
// GET /global/health, não é baseado em heartbeat/SSE. `undefined` no
// mapa = "ainda não verificado" (bolinha cinza), distinto de
// `{healthy:false}` (falhou de verdade).
const POLL_INTERVAL_MS = 10_000;

export type HealthMap = Record<string, ServerHealth | undefined>;

export function useServerHealth(servers: ServerConnection[]): HealthMap {
  const [health, setHealth] = useState<HealthMap>({});
  const ids = servers.map((s) => s.id).join(',');

  useEffect(() => {
    if (!ids) return;
    let cancelled = false;
    let appActive = AppState.currentState === 'active';

    async function refresh() {
      if (!appActive || cancelled) return;
      await Promise.all(
        servers.map(async (server) => {
          const token = await getServerToken(server.id);
          if (!token || cancelled) return;
          const result = await checkServerHealth(server, token);
          if (!cancelled) setHealth((prev) => ({ ...prev, [server.id]: result }));
        })
      );
    }

    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    // Pausa o polling com o app minimizado (economia de bateria/dados —
    // o desktop não precisa disso, mas faz sentido num cliente mobile)
    // e força uma verificação na hora assim que volta ao primeiro plano.
    const sub = AppState.addEventListener('change', (state) => {
      const wasActive = appActive;
      appActive = state === 'active';
      if (appActive && !wasActive) refresh();
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  return health;
}
