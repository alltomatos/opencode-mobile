import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { createSession, openProject, runShell } from '../../../../src/lib/api';
import { getServerToken, listServers, ServerConnection } from '../../../../src/lib/servers';
import { Theme, useTheme } from '../../../../src/lib/theme';

// Padroniza projetos em /home/opencode/projects/<nome> (pedido do
// usuário). Não existe endpoint de mkdir/clone dedicado — o caminho
// aqui é criar uma sessão "bootstrap" ancorada em /home/opencode (que
// sempre existe, é o home do usuário do servidor) e rodar
// mkdir/git clone via POST /session/:id/shell.
const PROJECTS_ROOT = '/home/opencode/projects';
const BOOTSTRAP_DIRECTORY = '/home/opencode';

function slugFromGithubUrl(url: string): string | null {
  const match = url.trim().match(/github\.com[/:]([^/]+)\/([^/]+?)(\.git)?\/?$/i);
  return match ? match[2] : null;
}

type Mode = 'folder' | 'github';

export default function AddProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const styles = createStyles(theme);

  const [server, setServer] = useState<ServerConnection | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('folder');
  const [name, setName] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listServers().then(async (servers) => {
      const found = servers.find((s) => s.id === id) ?? null;
      setServer(found);
      if (found) setToken(await getServerToken(found.id));
    });
  }, [id]);

  async function handleCreate() {
    if (!server || !token || saving) return;

    const folderName = mode === 'folder' ? name.trim() : slugFromGithubUrl(githubUrl);
    if (!folderName) {
      setError(mode === 'folder' ? 'Dá um nome pra pasta.' : 'Não consegui identificar o repositório nessa URL.');
      return;
    }

    const fullPath = `${PROJECTS_ROOT}/${folderName}`;
    setSaving(true);
    setError(null);
    try {
      setStatus('Preparando…');
      const bootstrap = await createSession(server, token, BOOTSTRAP_DIRECTORY);

      const command =
        mode === 'github' ? `git clone "${githubUrl.trim()}" "${fullPath}"` : `mkdir -p "${fullPath}"`;
      setStatus(mode === 'github' ? 'Clonando repositório…' : 'Criando pasta…');
      await runShell(server, token, bootstrap.id, command);

      setStatus('Abrindo projeto…');
      const project = await openProject(server, token, fullPath);
      router.replace(`/server/${id}/code/${project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao criar projeto.');
    } finally {
      setSaving(false);
      setStatus(null);
    }
  }

  const canSubmit = mode === 'folder' ? !!name.trim() : !!githubUrl.trim();

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, mode === 'folder' && styles.tabActive]}
          onPress={() => setMode('folder')}
        >
          <Text style={[styles.tabText, mode === 'folder' && styles.tabTextActive]}>Pasta nova</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, mode === 'github' && styles.tabActive]}
          onPress={() => setMode('github')}
        >
          <Text style={[styles.tabText, mode === 'github' && styles.tabTextActive]}>Clonar do GitHub</Text>
        </TouchableOpacity>
      </View>

      {mode === 'folder' ? (
        <>
          <Text style={styles.label}>Nome do projeto</Text>
          <Text style={styles.hint}>Cria {PROJECTS_ROOT}/{name.trim() || '<nome>'}</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="meu-projeto"
            placeholderTextColor={theme.placeholder}
            value={name}
            onChangeText={setName}
            autoFocus
          />
        </>
      ) : (
        <>
          <Text style={styles.label}>URL do repositório</Text>
          <Text style={styles.hint}>
            Clona em {PROJECTS_ROOT}/{slugFromGithubUrl(githubUrl) || '<repositório>'}
          </Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="https://github.com/usuario/repositorio"
            placeholderTextColor={theme.placeholder}
            value={githubUrl}
            onChangeText={setGithubUrl}
            autoFocus
          />
        </>
      )}

      {status && <Text style={styles.status}>{status}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}

      <Button title={saving ? 'Aguarde…' : 'Criar'} onPress={handleCreate} disabled={!canSubmit || saving} />
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: 24,
      gap: 12,
      backgroundColor: theme.bg,
    },
    tabs: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 8,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
      backgroundColor: theme.bgAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    tabActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    tabText: {
      fontWeight: '600',
      color: theme.textDim,
      fontSize: 13,
    },
    tabTextActive: {
      color: theme.accentText,
    },
    label: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '600',
    },
    hint: {
      color: theme.textFaint,
      fontSize: 12,
      marginBottom: 4,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: theme.text,
    },
    status: {
      color: theme.accent,
    },
    error: {
      color: theme.danger,
    },
  });
}
