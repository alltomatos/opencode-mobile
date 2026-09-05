import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../../../../src/components/ui/Button';
import { Section } from '../../../../src/components/ui/Section';
import { PROJECTS_ROOT, runManagedShell } from '../../../../src/lib/api';
import { getServerToken, listServers, ServerConnection } from '../../../../src/lib/servers';
import { Theme, useTheme } from '../../../../src/lib/theme';

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
      // `git init` na pasta nova é só um bônus (a maioria de projeto de
      // código já nasce versionado) — a listagem do app não depende
      // disso, ela lista pastas de verdade em PROJECTS_ROOT via
      // GET /file, então uma pasta sem git aparece do mesmo jeito.
      const command =
        mode === 'github'
          ? `git clone "${githubUrl.trim()}" "${fullPath}"`
          : `mkdir -p "${fullPath}" && git -C "${fullPath}" init`;
      setStatus(mode === 'github' ? 'Clonando repositório…' : 'Criando pasta…');
      await runManagedShell(server, token, command);

      router.replace(`/server/${id}/code/${encodeURIComponent(fullPath)}`);
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
      <View style={styles.segmented}>
        <View
          onTouchEnd={() => setMode('folder')}
          style={[styles.segment, mode === 'folder' && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, mode === 'folder' && styles.segmentTextActive]}>Pasta nova</Text>
        </View>
        <View
          onTouchEnd={() => setMode('github')}
          style={[styles.segment, mode === 'github' && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, mode === 'github' && styles.segmentTextActive]}>
            Clonar do GitHub
          </Text>
        </View>
      </View>

      {mode === 'folder' ? (
        <Section title="Nome do projeto" footer={`Cria ${PROJECTS_ROOT}/${name.trim() || '<nome>'}`}>
          <View style={styles.inputRow}>
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
          </View>
        </Section>
      ) : (
        <Section
          title="URL do repositório"
          footer={`Clona em ${PROJECTS_ROOT}/${slugFromGithubUrl(githubUrl) || '<repositório>'}`}
        >
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="https://github.com/usuario/repositorio"
              placeholderTextColor={theme.placeholder}
              value={githubUrl}
              onChangeText={setGithubUrl}
              autoFocus
            />
          </View>
        </Section>
      )}

      {status && <Text style={styles.status}>{status}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}

      <PrimaryButton title="Criar" onPress={handleCreate} disabled={!canSubmit} loading={saving} />
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: 16,
      gap: 20,
      backgroundColor: theme.bg,
    },
    segmented: {
      flexDirection: 'row',
      backgroundColor: theme.bgAlt,
      borderRadius: 9,
      padding: 2,
      gap: 2,
    },
    segment: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: 7,
      alignItems: 'center',
    },
    segmentActive: {
      backgroundColor: theme.surface,
    },
    segmentText: {
      fontWeight: '600',
      color: theme.textDim,
      fontSize: 13,
    },
    segmentTextActive: {
      color: theme.accent,
    },
    inputRow: {
      paddingHorizontal: 16,
      paddingVertical: 4,
      minHeight: 44,
      justifyContent: 'center',
    },
    input: {
      fontSize: 16,
      color: theme.text,
      padding: 0,
    },
    status: {
      color: theme.accent,
    },
    error: {
      color: theme.danger,
    },
  });
}
