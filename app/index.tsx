import { Ionicons } from '@expo/vector-icons';
import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StatusDot } from '../src/components/StatusDot';
import { PrimaryButton } from '../src/components/ui/Button';
import { EmptyState } from '../src/components/ui/EmptyState';
import { Row } from '../src/components/ui/Row';
import { Section } from '../src/components/ui/Section';
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
      <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
        <EmptyState
          icon="server-outline"
          title="Nenhum servidor pareado"
          subtitle="Escaneie o QR code em Configurações → Servidores no app desktop pra começar."
        />
        <View style={styles.emptyCta}>
          <PrimaryButton title="Parear servidor" onPress={() => router.push('/pair')} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} contentInsetAdjustmentBehavior="automatic">
        <Section title={servers.length === 1 ? '1 servidor' : `${servers.length} servidores`}>
          {servers.map((item, i) => (
            <Row
              key={item.id}
              icon="server-outline"
              iconColor={theme.accent}
              title={item.label}
              subtitle={`${item.url} · ${describeConnection(item.url)}`}
              onPress={() => router.push(`/server/${item.id}`)}
              accessory={
                <View style={styles.rowAccessory}>
                  <StatusDot health={health[item.id]} theme={theme} />
                  <Ionicons name="chevron-forward" size={18} color={theme.textFaint} />
                </View>
              }
              last={i === servers.length - 1}
            />
          ))}
        </Section>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <PrimaryButton title="+ Parear novo servidor" onPress={() => router.push('/pair')} />
      </View>
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    scroll: {
      paddingTop: 16,
      paddingBottom: 8,
    },
    emptyCta: {
      paddingHorizontal: 32,
    },
    rowAccessory: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    footer: {
      paddingHorizontal: 16,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      backgroundColor: theme.bg,
    },
  });
}
