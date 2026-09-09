import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton, TextButton } from '../src/components/ui/Button';
import { addServer, parsePairingPayload, verifyServer } from '../src/lib/servers';

// Fase 1 (docs/prd/mobile-api-reference.md §4): decodifica o payload
// { v, url, token, label } do QR code gerado pelo app desktop, valida
// contra GET /instance, e salva como um novo ServerConnection local.
export default function PairScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<'scanning' | 'checking' | 'error'>('scanning');
  const [error, setError] = useState<string | null>(null);
  const [manualPayload, setManualPayload] = useState('');
  const [showManual, setShowManual] = useState(false);

  async function pair(data: string) {
    // A câmera continua no ar (e escaneando) mesmo depois de um erro —
    // com o QR parado na frente dela, cada frame novo disparava pair()
    // de novo, entrando num loop de tentativas simultâneas (cada uma com
    // seu próprio fetch+timeout) que travava a thread JS a ponto do
    // Android matar/minimizar o app (visto ao vivo no Expo Go). Só
    // aceita um novo scan a partir do estado 'scanning' — que só volta
    // a valer quando a pessoa toca em "Tentar de novo" ou "Usar câmera".
    if (status !== 'scanning') return;
    setStatus('checking');
    setError(null);
    try {
      const payload = parsePairingPayload(data);
      const result = await verifyServer(payload.url, payload.token);
      if (!result.ok) {
        throw new Error(result.reason);
      }
      const server = await addServer(payload);
      router.replace(`/server/${server.id}/code`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payload inválido.');
      setStatus('error');
    }
  }

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.subtitle}>Precisamos da câmera pra ler o QR code de pareamento.</Text>
        <PrimaryButton title="Permitir câmera" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {!showManual && (
        <>
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={(result) => pair(result.data)}
          />
          <View pointerEvents="none" style={styles.scanFrame} />
        </>
      )}

      {showManual && (
        <View style={styles.manualForm}>
          <Text style={styles.manualLabel}>Cole o payload de pareamento (JSON)</Text>
          <TextInput
            style={styles.manualInput}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            placeholder='{"v":1,"url":"...","token":"...","label":"..."}'
            placeholderTextColor="#8e8e93"
            value={manualPayload}
            onChangeText={setManualPayload}
          />
          <PrimaryButton title="Parear" onPress={() => pair(manualPayload)} />
        </View>
      )}

      <View style={styles.overlay}>
        {status === 'checking' && (
          <View style={styles.statusPill}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.overlayText}>Validando servidor…</Text>
          </View>
        )}
        {status === 'error' && (
          <>
            <View style={styles.statusPill}>
              <Text style={styles.overlayText}>{error}</Text>
            </View>
            <PrimaryButton title="Tentar de novo" onPress={() => setStatus('scanning')} />
          </>
        )}
        {status === 'scanning' && (
          <TextButton title={showManual ? 'Usar câmera' : 'Colar manualmente'} onPress={() => setShowManual((v) => !v)} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  subtitle: {
    textAlign: 'center',
    color: '#98989f',
  },
  scanFrame: {
    position: 'absolute',
    top: '28%',
    left: '15%',
    right: '15%',
    aspectRatio: 1,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  manualForm: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  manualLabel: {
    color: '#fff',
    fontSize: 15,
  },
  manualInput: {
    minHeight: 120,
    color: '#fff',
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    textAlignVertical: 'top',
  },
  overlay: {
    position: 'absolute',
    bottom: 48,
    left: 24,
    right: 24,
    alignItems: 'center',
    gap: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(28,28,30,0.85)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  overlayText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
});
