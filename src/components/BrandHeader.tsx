import { Image, StyleSheet, Text, View } from 'react-native';

import { Theme } from '../lib/theme';

// Usado no lugar do título "Servidores" na tela raiz — pedido do
// usuário pra dar identidade visual de marca no topo do app.
export function BrandHeader({ theme }: { theme: Theme }) {
  const styles = createStyles(theme);
  return (
    <View style={styles.row}>
      <Image source={require('../../assets/opencode-icon-cutout.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>
        OpenCode <Text style={styles.subtitle}>by alltomatos</Text>
      </Text>
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    logo: {
      width: 26,
      height: 26,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.text,
    },
    subtitle: {
      fontSize: 13,
      fontWeight: '400',
      color: theme.textDim,
    },
  });
}
