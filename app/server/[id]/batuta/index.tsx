import { StyleSheet, Text, View } from 'react-native';

import { Theme, useTheme } from '../../../../src/lib/theme';

// Placeholder — Batuta (docs/prd/mobile-app.md §3, item 2) ainda não
// foi implementado no mobile. Rota /batuta já mapeada no
// mobile-api-reference.md §6.1.
export default function BatutaScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Batuta ainda não chegou aqui</Text>
      <Text style={styles.subtitle}>
        Visualização de atividades e orquestração multi-agente — próximo passo do roadmap.
      </Text>
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
  });
}
