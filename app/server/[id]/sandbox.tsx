import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { useTheme } from '../../../src/lib/theme';

export default function SandboxScreen() {
  const { initialUrl } = useLocalSearchParams<{ initialUrl?: string }>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = createStyles(theme);

  const [inputUrl, setInputUrl] = useState(initialUrl || 'http://localhost:3000');
  const [currentUrl, setCurrentUrl] = useState(initialUrl || 'http://localhost:3000');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);

  function handleNavigate() {
    let target = inputUrl.trim();
    if (!target) return;
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = `http://${target}`;
    }
    setInputUrl(target);
    setCurrentUrl(target);
    setError(null);
  }

  function handleRefresh() {
    setError(null);
    webViewRef.current?.reload();
  }

  function handleOpenExternal() {
    if (currentUrl) {
      Linking.openURL(currentUrl).catch(() => {});
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.addressBar}>
          <Ionicons name="globe-outline" size={16} color={theme.textFaint} />
          <TextInput
            style={styles.addressInput}
            value={inputUrl}
            onChangeText={setInputUrl}
            onSubmitEditing={handleNavigate}
            placeholder="http://..."
            placeholderTextColor={theme.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>

        <TouchableOpacity style={styles.headerBtn} onPress={handleRefresh}>
          <Ionicons name="refresh-outline" size={20} color={theme.accent} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerBtn} onPress={handleOpenExternal}>
          <Ionicons name="open-outline" size={20} color={theme.accent} />
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color={theme.accent} />
          <Text style={styles.loadingText}>Carregando WebGL2 / WebGPU Sandbox…</Text>
        </View>
      )}

      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.warnText} />
          <Text style={styles.errorTitle}>Falha ao carregar a aplicação</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRefresh}>
            <Text style={styles.retryBtnText}>Tentar Novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ uri: currentUrl }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          originWhitelist={['*']}
          mediaPlaybackRequiresUserAction={false}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            setLoading(false);
            setError(nativeEvent.description || 'Não foi possível conectar ao servidor web.');
          }}
        />
      )}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      backgroundColor: theme.surface,
    },
    headerBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.bgAlt,
    },
    addressBar: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.bgAlt,
      borderRadius: 10,
      paddingHorizontal: 10,
      height: 36,
    },
    addressInput: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
      padding: 0,
    },
    loadingBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 6,
      backgroundColor: theme.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    loadingText: {
      fontSize: 12,
      color: theme.textDim,
    },
    webview: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
      gap: 12,
    },
    errorTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
    },
    errorSubtitle: {
      fontSize: 14,
      color: theme.textDim,
      textAlign: 'center',
    },
    retryBtn: {
      marginTop: 8,
      paddingVertical: 10,
      paddingHorizontal: 20,
      backgroundColor: theme.accent,
      borderRadius: 10,
    },
    retryBtnText: {
      color: theme.accentText,
      fontWeight: '600',
      fontSize: 14,
    },
  });
}
