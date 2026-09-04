import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useState } from 'react';
import { Button, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

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
    if (status === 'checking') return;
    setStatus('checking');
    setError(null);
    try {
      const payload = parsePairingPayload(data);
      const ok = await verifyServer(payload.url, payload.token);
      if (!ok) {
        throw new Error('Servidor não respondeu — confira a URL e a rede.');
      }
      const server = await addServer(payload);
      router.replace(`/server/${server.id}`);
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
      <View style={styles.container}>
        <Text style={styles.subtitle}>Precisamos da câmera para ler o QR code de pareamento.</Text>
        <Button title="Permitir câmera" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {!showManual && (
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={(result) => pair(result.data)}
        />
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
            placeholderTextColor="#6b7280"
            value={manualPayload}
            onChangeText={setManualPayload}
          />
          <Button title="Parear" onPress={() => pair(manualPayload)} />
        </View>
      )}

      <View style={styles.overlay}>
        {status === 'checking' && <Text style={styles.overlayText}>Validando servidor…</Text>}
        {status === 'error' && (
          <>
            <Text style={styles.overlayText}>{error}</Text>
            <Button title="Tentar de novo" onPress={() => setStatus('scanning')} />
          </>
        )}
        {status === 'scanning' && (
          <Button
            title={showManual ? 'Usar câmera' : 'Colar manualmente'}
            onPress={() => setShowManual((v) => !v)}
          />
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
  subtitle: {
    textAlign: 'center',
    color: '#6b7280',
    padding: 24,
  },
  manualForm: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  manualLabel: {
    color: '#fff',
    fontSize: 14,
  },
  manualInput: {
    minHeight: 120,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    padding: 12,
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
  overlayText: {
    color: '#fff',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 12,
    borderRadius: 8,
  },
});
