import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listServers, ServerConnection } from '../src/lib/servers';

export default function ServerListScreen() {
  const [servers, setServers] = useState<ServerConnection[] | null>(null);
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      listServers().then(setServers);
    }, [])
  );

  if (servers === null) {
    return <View style={styles.container} />;
  }

  if (servers.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Nenhum servidor pareado</Text>
        <Text style={styles.subtitle}>
          Escaneie o QR code em Configurações → Servidores no app desktop para começar.
        </Text>
        <Link href="/pair" style={styles.link}>
          Parear servidor
        </Link>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      <FlatList
        data={servers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Link href={`/server/${item.id}`} asChild>
            <Pressable style={styles.row}>
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Text style={styles.rowUrl}>{item.url}</Text>
            </Pressable>
          </Link>
        )}
      />
      <Link href="/pair" style={[styles.addLink, { paddingBottom: insets.bottom + 16 }]}>
        + Parear novo servidor
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    textAlign: 'center',
    color: '#6b7280',
  },
  link: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
  list: {
    flex: 1,
  },
  row: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowUrl: {
    color: '#6b7280',
    marginTop: 2,
  },
  addLink: {
    textAlign: 'center',
    padding: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
});
