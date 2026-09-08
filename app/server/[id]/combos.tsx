import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '../../../src/components/ui/EmptyState';
import { Row } from '../../../src/components/ui/Row';
import { Section } from '../../../src/components/ui/Section';
import {
  Combo,
  ComboModel,
  deleteCombo,
  listCombos,
  listProviders,
  Model,
  Provider,
  saveCombo,
} from '../../../src/lib/api';
import { getServerToken, listServers, ServerConnection } from '../../../src/lib/servers';
import { Theme, useTheme } from '../../../src/lib/theme';

type FormState = {
  id: string;
  name: string;
  models: ComboModel[];
  failoverEnabled: boolean;
  strategy: 'priority' | 'round-robin';
  requestsPerMinute: string;
  tokensPerMinute: string;
};

function emptyForm(): FormState {
  return {
    id: Crypto.randomUUID(),
    name: '',
    models: [],
    failoverEnabled: true,
    strategy: 'priority',
    requestsPerMinute: '',
    tokensPerMinute: '',
  };
}

function formFromCombo(combo: Combo): FormState {
  return {
    id: combo.id,
    name: combo.name,
    models: combo.models,
    failoverEnabled: combo.failover?.enabled ?? true,
    strategy: combo.failover?.strategy ?? 'priority',
    requestsPerMinute: combo.rateLimit?.requestsPerMinute ? String(combo.rateLimit.requestsPerMinute) : '',
    tokensPerMinute: combo.rateLimit?.tokensPerMinute ? String(combo.rateLimit.tokensPerMinute) : '',
  };
}

export default function CombosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = createStyles(theme);

  const [server, setServer] = useState<ServerConnection | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [combos, setCombos] = useState<Combo[] | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    listServers().then(async (list) => {
      const found = list.find((s) => s.id === id) ?? null;
      setServer(found);
      if (!found) return;
      const t = await getServerToken(found.id);
      setToken(t);
      if (!t) return;
      reload(found, t);
      listProviders(found, t)
        .then((data) => setProviders(data.all))
        .catch(() => {});
    });
  }, [id]);

  async function reload(target: ServerConnection, tok: string) {
    try {
      setCombos(await listCombos(target, tok));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar combos.');
    }
  }

  function openNew() {
    setForm(emptyForm());
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(combo: Combo) {
    setForm(formFromCombo(combo));
    setFormError(null);
    setShowForm(true);
  }

  function handleRowPress(combo: Combo) {
    Alert.alert(combo.name, undefined, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Editar', onPress: () => openEdit(combo) },
      { text: 'Apagar', style: 'destructive', onPress: () => confirmDelete(combo) },
    ]);
  }

  function confirmDelete(combo: Combo) {
    Alert.alert('Apagar combo', `Remover "${combo.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          if (!server || !token) return;
          try {
            await deleteCombo(server, token, combo.id);
            await reload(server, token);
          } catch (e) {
            Alert.alert('Erro', e instanceof Error ? e.message : 'Falha ao apagar combo.');
          }
        },
      },
    ]);
  }

  function addModelToForm(model: Model, provider: Provider) {
    setForm((f) => ({
      ...f,
      models: [...f.models, { model: `${provider.id}/${model.id}`, priority: f.models.length }],
    }));
    setShowModelPicker(false);
  }

  function removeModelFromForm(idx: number) {
    setForm((f) => ({ ...f, models: f.models.filter((_, i) => i !== idx) }));
  }

  async function handleSave() {
    if (!server || !token) return;
    if (!form.name.trim()) {
      setFormError('Dê um nome ao combo.');
      return;
    }
    if (form.models.length === 0) {
      setFormError('Adicione pelo menos um modelo.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const combo: Combo = {
        id: form.id,
        name: form.name.trim(),
        models: form.models,
        failover: { enabled: form.failoverEnabled, strategy: form.strategy },
        rateLimit:
          form.requestsPerMinute.trim() || form.tokensPerMinute.trim()
            ? {
                requestsPerMinute: form.requestsPerMinute.trim() ? Number(form.requestsPerMinute) : undefined,
                tokensPerMinute: form.tokensPerMinute.trim() ? Number(form.tokensPerMinute) : undefined,
              }
            : undefined,
      };
      await saveCombo(server, token, combo);
      setShowForm(false);
      await reload(server, token);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Falha ao salvar combo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 96 }]}
        contentInsetAdjustmentBehavior="automatic"
      >
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color={theme.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {combos === null ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={theme.accent} />
        ) : combos.length === 0 ? (
          <EmptyState
            icon="layers-outline"
            title="Nenhum combo ainda"
            subtitle="Crie um pool de modelos com failover automático entre provedores."
          />
        ) : (
          <Section title={combos.length === 1 ? '1 combo' : `${combos.length} combos`}>
            {combos.map((combo, i) => (
              <Row
                key={combo.id}
                icon="layers-outline"
                iconColor="#ff9500"
                title={combo.name}
                subtitle={`${combo.models.length} modelo${combo.models.length === 1 ? '' : 's'} · ${
                  combo.failover?.enabled ? `failover (${combo.failover.strategy})` : 'sem failover'
                }`}
                onPress={() => handleRowPress(combo)}
                last={i === combos.length - 1}
              />
            ))}
          </Section>
        )}
      </ScrollView>

      <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + 20 }]} onPress={openNew} accessibilityLabel="Novo combo">
        <Ionicons name="add" size={28} color={theme.accentText} />
      </TouchableOpacity>

      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowForm(false)}>
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalGrabber} />
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{form.name ? 'Editar combo' : 'Novo combo'}</Text>

              {formError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorTextInModal}>{formError}</Text>
                </View>
              )}

              <Text style={styles.label}>Nome</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="Ex.: Rápido e barato"
                placeholderTextColor={theme.placeholder}
              />

              <Text style={styles.label}>Modelos</Text>
              {form.models.map((m, idx) => (
                <View key={`${m.model}-${idx}`} style={styles.modelRow}>
                  <Text style={styles.modelRowText} numberOfLines={1}>
                    {idx + 1}. {m.model}
                  </Text>
                  <TouchableOpacity onPress={() => removeModelFromForm(idx)}>
                    <Ionicons name="close-circle" size={20} color={theme.danger} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.addRowBtn} onPress={() => setShowModelPicker(true)}>
                <Ionicons name="add-circle-outline" size={18} color={theme.accent} style={{ marginRight: 6 }} />
                <Text style={styles.addRowBtnText}>Adicionar modelo</Text>
              </TouchableOpacity>

              <View style={styles.switchRow}>
                <Text style={styles.label}>Failover automático</Text>
                <Switch
                  value={form.failoverEnabled}
                  onValueChange={(v) => setForm((f) => ({ ...f, failoverEnabled: v }))}
                  trackColor={{ true: theme.accent, false: theme.border }}
                />
              </View>

              {form.failoverEnabled && (
                <View style={styles.segmented}>
                  {(['priority', 'round-robin'] as const).map((s) => {
                    const active = form.strategy === s;
                    return (
                      <TouchableOpacity
                        key={s}
                        style={[styles.segment, active && styles.segmentActive]}
                        onPress={() => setForm((f) => ({ ...f, strategy: s }))}
                      >
                        <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                          {s === 'priority' ? 'Prioridade' : 'Round-robin'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Text style={styles.label}>Rate limit (opcional)</Text>
              <View style={styles.rateLimitRow}>
                <TextInput
                  style={[styles.input, styles.rateLimitInput]}
                  value={form.requestsPerMinute}
                  onChangeText={(v) => setForm((f) => ({ ...f, requestsPerMinute: v.replace(/[^0-9]/g, '') }))}
                  placeholder="Reqs/min"
                  placeholderTextColor={theme.placeholder}
                  keyboardType="number-pad"
                />
                <TextInput
                  style={[styles.input, styles.rateLimitInput]}
                  value={form.tokensPerMinute}
                  onChangeText={(v) => setForm((f) => ({ ...f, tokensPerMinute: v.replace(/[^0-9]/g, '') }))}
                  placeholder="Tokens/min"
                  placeholderTextColor={theme.placeholder}
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.formBtnRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)} disabled={saving}>
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator color={theme.accentText} size="small" /> : <Text style={styles.saveBtnText}>Salvar</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showModelPicker} transparent animationType="slide" onRequestClose={() => setShowModelPicker(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowModelPicker(false)}>
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalGrabber} />
            <Text style={styles.modalTitle}>Escolher modelo</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {providers.map((p) =>
                Object.values(p.models).map((m) => (
                  <TouchableOpacity key={`${p.id}-${m.id}`} style={styles.catalogRow} onPress={() => addModelToForm(m, p)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.catalogName}>{m.name || m.id}</Text>
                      <Text style={styles.catalogSubtitle}>{p.name}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    scroll: { padding: 16, gap: 20 },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 10,
      borderRadius: 10,
      backgroundColor: theme.dangerBg,
    },
    errorText: { flex: 1, color: theme.danger, fontSize: 13 },
    fab: {
      position: 'absolute',
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 32,
      maxHeight: '85%',
    },
    modalGrabber: {
      alignSelf: 'center',
      width: 36,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.border,
      marginTop: 8,
      marginBottom: 12,
    },
    modalTitle: { fontSize: 17, fontWeight: '600', color: theme.text, marginBottom: 12 },
    errorBox: { backgroundColor: 'rgba(255, 59, 48, 0.1)', padding: 10, borderRadius: 8, marginBottom: 12 },
    errorTextInModal: { color: theme.warnText, fontSize: 13 },
    label: { fontSize: 13, fontWeight: '600', color: theme.textDim, marginTop: 14, marginBottom: 6 },
    input: {
      backgroundColor: theme.bgAlt,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 15,
      color: theme.text,
    },
    modelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.bgAlt,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 8,
    },
    modelRowText: { flex: 1, fontSize: 14, color: theme.text, marginRight: 8 },
    addRowBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bgAlt,
      paddingVertical: 10,
      borderRadius: 10,
      marginTop: 4,
    },
    addRowBtnText: { fontSize: 14, fontWeight: '600', color: theme.accent },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 14,
    },
    segmented: {
      flexDirection: 'row',
      backgroundColor: theme.bgAlt,
      borderRadius: 9,
      padding: 2,
      gap: 2,
      marginTop: 8,
    },
    segment: { flex: 1, paddingVertical: 8, borderRadius: 7, alignItems: 'center' },
    segmentActive: { backgroundColor: theme.surface },
    segmentText: { fontSize: 13, fontWeight: '600', color: theme.textDim },
    segmentTextActive: { color: theme.accent },
    rateLimitRow: { flexDirection: 'row', gap: 10 },
    rateLimitInput: { flex: 1 },
    formBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20 },
    cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: theme.bgAlt },
    cancelBtnText: { fontSize: 14, fontWeight: '600', color: theme.textDim },
    saveBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, backgroundColor: theme.accent },
    saveBtnText: { fontSize: 14, fontWeight: '600', color: theme.accentText },
    catalogRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    catalogName: { fontSize: 15, fontWeight: '600', color: theme.text },
    catalogSubtitle: { fontSize: 12, color: theme.textDim, marginTop: 2 },
  });
}
