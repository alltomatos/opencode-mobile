import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../../../src/components/ui/Button';
import { Section } from '../../../src/components/ui/Section';
import {
  getServerToken,
  listServers,
  ServerConnection,
  updateServer,
  updateServerToken,
  verifyServer,
} from '../../../src/lib/servers';
import { Theme, useTheme } from '../../../src/lib/theme';

export default function EditServerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const styles = createStyles(theme);

  const [server, setServer] = useState<ServerConnection | null>(null);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listServers().then(async (servers) => {
      const found = servers.find((s) => s.id === id) ?? null;
      setServer(found);
      if (found) {
        setLabel(found.label);
        setUrl(found.url);
        // O token de verdade fica no SecureStore, separado do
        // manifesto — não mostramos o valor atual (é uma credencial),
        // só deixamos trocar por um novo se o usuário colar um.
      }
    });
  }, [id]);

  async function handleSave() {
    if (!server) return;
    const trimmedLabel = label.trim();
    const trimmedUrl = url.trim();
    const trimmedToken = token.trim();
    if (!trimmedLabel || !trimmedUrl) {
      setError('Nome e URL não podem ficar em branco.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const tokenToVerify = trimmedToken || (await getServerToken(server.id)) || '';
      const result = await verifyServer(trimmedUrl, tokenToVerify);
      if (!result.ok) {
        throw new Error(result.reason);
      }
      await updateServer(server.id, { label: trimmedLabel, url: trimmedUrl });
      if (trimmedToken) {
        await updateServerToken(server.id, trimmedToken);
      }
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  if (!server) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <Section title="Nome">
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={label}
            onChangeText={setLabel}
            placeholder="Ex.: Omniroute (Tailscale)"
            placeholderTextColor={theme.placeholder}
            autoCapitalize="words"
          />
        </View>
      </Section>

      <Section title="URL">
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="http://100.x.x.x:4096"
            placeholderTextColor={theme.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>
      </Section>

      <Section title="Token" footer="Deixe em branco pra manter o token atual. Só preencha se o servidor gerou um novo.">
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={token}
            onChangeText={setToken}
            placeholder="(sem alteração)"
            placeholderTextColor={theme.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
        </View>
      </Section>

      {error && <Text style={styles.error}>{error}</Text>}

      <PrimaryButton title="Salvar" onPress={handleSave} loading={saving} />
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
    error: {
      color: theme.danger,
      fontSize: 13,
    },
  });
}
