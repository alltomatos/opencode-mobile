import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function ServerListScreen() {
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
});
