import { StyleSheet, View } from 'react-native';

import { ServerHealth } from '../lib/api';
import { Theme } from '../lib/theme';

// Verde = healthy, vermelho = checado e falhou, cinza = ainda não
// verificado — igual ao ServerHealthIndicator do desktop
// (packages/app/src/components/server/server-row.tsx).
export function StatusDot({ health, theme }: { health: ServerHealth | undefined; theme: Theme }) {
  const color = health === undefined ? theme.textFaint : health.healthy ? theme.success : theme.danger;
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
});
