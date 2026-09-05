import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StatusDot } from '../src/components/StatusDot';
import { describeConnection, listServers, ServerConnection } from '../src/lib/servers';
import { useServerHealth } from '../src/lib/serverHealth';
import { Theme, useTheme } from '../src/lib/theme';

export default function ServerListScreen() {
  const [servers, setServers] = useState<ServerConnection[] | null>(null);
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = createStyles(theme);
  const health = useServerHealth(servers ?? []);

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
              <View style={styles.rowHeader}>
                <StatusDot health={health[item.id]} theme={theme} />
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowConnectionType}>{describeConnection(item.url)}</Text>
              </View>
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

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 12,
      backgroundColor: theme.bg,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
    },
    subtitle: {
      textAlign: 'center',
      color: theme.textDim,
    },
    link: {
      marginTop: 12,
      fontSize: 16,
      fontWeight: '600',
      color: theme.accent,
    },
    list: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    row: {
      padding: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    rowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    rowLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    rowConnectionType: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textFaint,
      textTransform: 'uppercase',
      backgroundColor: theme.bgAlt,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    rowUrl: {
      color: theme.textDim,
      marginTop: 2,
      marginLeft: 17,
    },
    addLink: {
      textAlign: 'center',
      padding: 16,
      fontSize: 16,
      fontWeight: '600',
      color: theme.accent,
    },
  });
}
