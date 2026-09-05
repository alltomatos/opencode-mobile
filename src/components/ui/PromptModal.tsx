import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Theme, useTheme } from '../../lib/theme';

// Alert.prompt só existe no iOS — RN não tem um prompt de texto nativo
// cross-platform. Esse modal cobre o caso simples (editar um campo de
// texto único), estilo UIAlertController com textfield.
export function PromptModal({
  visible,
  title,
  message,
  initialValue,
  placeholder,
  confirmLabel = 'Salvar',
  onCancel,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  message?: string;
  initialValue: string;
  placeholder?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity activeOpacity={1} style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {message && <Text style={styles.message}>{message}</Text>}
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={theme.placeholder}
            autoFocus
            selectTextOnFocus
          />
          <View style={styles.actions}>
            <TouchableOpacity style={styles.button} onPress={onCancel}>
              <Text style={styles.buttonText}>Cancelar</Text>
            </TouchableOpacity>
            <View style={styles.buttonDivider} />
            <TouchableOpacity
              style={styles.button}
              onPress={() => {
                const trimmed = value.trim();
                if (trimmed) onSubmit(trimmed);
              }}
            >
              <Text style={[styles.buttonText, styles.buttonTextConfirm]}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    card: {
      width: '100%',
      maxWidth: 320,
      borderRadius: 14,
      backgroundColor: theme.surface,
      overflow: 'hidden',
      paddingTop: 18,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      textAlign: 'center',
      paddingHorizontal: 16,
    },
    message: {
      fontSize: 13,
      color: theme.textDim,
      textAlign: 'center',
      paddingHorizontal: 16,
      marginTop: 4,
    },
    input: {
      marginTop: 14,
      marginHorizontal: 16,
      backgroundColor: theme.bgAlt,
      borderRadius: 9,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 15,
      color: theme.text,
    },
    actions: {
      flexDirection: 'row',
      marginTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    button: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
    },
    buttonDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
    },
    buttonText: {
      fontSize: 16,
      color: theme.accent,
    },
    buttonTextConfirm: {
      fontWeight: '600',
    },
  });
}
