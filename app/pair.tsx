import { StyleSheet, Text, View } from 'react-native';

// Fase 1 (docs/prd/mobile-api-reference.md, seção 4): decodifica o payload
// { v, url, token, label } do QR code gerado pelo app desktop e salva como
// um novo ServerConnection local. Leitura de câmera (expo-camera) entra
// aqui quando o scanner for implementado.
export default function PairScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Escanear QR code</Text>
      <Text style={styles.subtitle}>
        Scanner de câmera ainda não implementado — próximo passo desta tela.
      </Text>
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
});
