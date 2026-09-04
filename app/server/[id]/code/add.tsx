import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { openProject } from '../../../../src/lib/api';
import { getServerToken, listServers, ServerConnection } from '../../../../src/lib/servers';
import { Theme, useTheme } from '../../../../src/lib/theme';

// Não existe endpoint de "criar projeto" — um caminho absoluto vira
// projeto conhecido do servidor assim que qualquer rota roteada por
// workspace é chamada com ele (ver src/lib/api.ts, openProject()).
export default function AddProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const styles = createStyles(theme);

  const [server, setServer] = useState<ServerConnection | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [path, setPath] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listServers().then(async (servers) => {
      const found = servers.find((s) => s.id === id) ?? null;
      setServer(found);
      if (found) setToken(await getServerToken(found.id));
    });
  }, [id]);

  async function handleAdd() {
    const directory = path.trim();
    if (!directory || !server || !token || saving) return;
    setSaving(true);
    setError(null);
    try {
      const project = await openProject(server, token, directory);
      router.replace(`/server/${id}/code/${project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao abrir projeto.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Caminho absoluto da pasta no servidor</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="/home/opencode/meu-projeto"
        placeholderTextColor={theme.placeholder}
        value={path}
        onChangeText={setPath}
        autoFocus
        keyboardType={Platform.select({ ios: 'default', android: 'default' })}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Button title={saving ? 'Abrindo…' : 'Adicionar'} onPress={handleAdd} disabled={!path.trim() || saving} />
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
    label: {
      color: theme.textDim,
      fontSize: 13,
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
    error: {
      color: theme.danger,
    },
  });
}
