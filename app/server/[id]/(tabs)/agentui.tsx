import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '../../../../src/components/ui/EmptyState';
import { Row } from '../../../../src/components/ui/Row';
import { Section } from '../../../../src/components/ui/Section';
import {
  AgentUIAgent,
  AgentUIRagSource,
  Combo,
  deleteAgentUIAgent,
  isAgentUIEnabled,
  listAgentUIAgents,
  listAllProjects,
  listCombos,
  listProviders,
  Model,
  ProjectFolder,
  Provider,
  resetAgentUISandbox,
  saveAgentUIAgent,
  testAgentUIAgent,
} from '../../../../src/lib/api';
import { getServerToken, listServers, ServerConnection } from '../../../../src/lib/servers';
import { Theme, useTheme } from '../../../../src/lib/theme';

type FormState = {
  id: string;
  name: string;
  personality: string;
  model: string;
  enabled: boolean;
  telegramEnabled: boolean;
  commandTriggers: string;
  ragSources: AgentUIRagSource[];
  guardrailsEnabled: boolean;
  guardrailsLevel: 'basic' | 'strict';
};

function emptyForm(): FormState {
  return {
    id: Crypto.randomUUID(),
    name: '',
    personality: '',
    model: '',
    enabled: true,
    telegramEnabled: false,
    commandTriggers: '!',
    ragSources: [],
    guardrailsEnabled: true,
    guardrailsLevel: 'basic',
  };
}

function formFromAgent(agent: AgentUIAgent): FormState {
  return {
    id: agent.id,
    name: agent.name,
    personality: agent.personality,
    model: agent.model,
    enabled: isAgentUIEnabled(agent),
    telegramEnabled: agent.channels?.some((c) => c.type === 'telegram') ?? false,
    commandTriggers: (agent.commandTriggers ?? []).join(' ') || '!',
    ragSources: agent.ragSources ?? [],
    guardrailsEnabled: agent.guardrails?.enabled ?? true,
    guardrailsLevel: agent.guardrails?.level ?? 'basic',
  };
}

export default function AgentUIScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = createStyles(theme);

  const [server, setServer] = useState<ServerConnection | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentUIAgent[] | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [projects, setProjects] = useState<ProjectFolder[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [isNewAgent, setIsNewAgent] = useState(true);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [showSandbox, setShowSandbox] = useState(false);
  const [sandboxDirectory, setSandboxDirectory] = useState<string | null>(null);
  const [sandboxMessages, setSandboxMessages] = useState<{ role: 'user' | 'agent'; text: string; blocked?: boolean }[]>([]);
  const [sandboxInput, setSandboxInput] = useState('');
  const [sandboxSending, setSandboxSending] = useState(false);
  const [sandboxError, setSandboxError] = useState<string | null>(null);

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
      listCombos(found, t)
        .then(setCombos)
        .catch(() => {});
      listAllProjects(found, t)
        .then((list) => {
          setProjects(list);
          if (list.length > 0) setSandboxDirectory((cur) => cur ?? list[0].path);
        })
        .catch(() => {});
    });
  }, [id]);

  async function reload(target: ServerConnection, tok: string) {
    try {
      setAgents(await listAgentUIAgents(target, tok));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar agentes.');
    }
  }

  function openNew() {
    setForm(emptyForm());
    setIsNewAgent(true);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(agent: AgentUIAgent) {
    setForm(formFromAgent(agent));
    setIsNewAgent(false);
    setFormError(null);
    setShowForm(true);
  }

  function openSandbox(agentId: string) {
    setSandboxMessages([]);
    setSandboxInput('');
    setSandboxError(null);
    setShowSandbox(true);
    if (server && token) {
      resetAgentUISandbox(server, token, agentId).catch(() => {});
    }
  }

  async function handleSendSandboxMessage() {
    if (!server || !token || !sandboxDirectory || !sandboxInput.trim()) return;
    const message = sandboxInput.trim();
    setSandboxMessages((msgs) => [...msgs, { role: 'user', text: message }]);
    setSandboxInput('');
    setSandboxSending(true);
    setSandboxError(null);
    try {
      const result = await testAgentUIAgent(server, token, form.id, sandboxDirectory, message);
      setSandboxMessages((msgs) => [...msgs, { role: 'agent', text: result.reply, blocked: result.blocked }]);
    } catch (e) {
      setSandboxError(e instanceof Error ? e.message : 'Falha ao enviar mensagem de teste.');
    } finally {
      setSandboxSending(false);
    }
  }

  async function toggleAgentEnabled(agent: AgentUIAgent, value: boolean) {
    if (!server || !token) return;
    try {
      await saveAgentUIAgent(server, token, { ...agent, enabled: value });
      await reload(server, token);
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Falha ao atualizar agente.');
    }
  }

  function handleRowPress(agent: AgentUIAgent) {
    Alert.alert(agent.name, undefined, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Editar', onPress: () => openEdit(agent) },
      { text: 'Apagar', style: 'destructive', onPress: () => confirmDelete(agent) },
    ]);
  }

  function confirmDelete(agent: AgentUIAgent) {
    Alert.alert('Apagar agente', `Remover "${agent.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          if (!server || !token) return;
          try {
            await deleteAgentUIAgent(server, token, agent.id);
            await reload(server, token);
          } catch (e) {
            Alert.alert('Erro', e instanceof Error ? e.message : 'Falha ao apagar agente.');
          }
        },
      },
    ]);
  }

  function addRagSource() {
    setForm((f) => ({
      ...f,
      ragSources: [...f.ragSources, { id: Crypto.randomUUID(), kind: 'text', label: '', value: '' }],
    }));
  }

  function updateRagSource(idx: number, patch: Partial<AgentUIRagSource>) {
    setForm((f) => ({
      ...f,
      ragSources: f.ragSources.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  }

  function removeRagSource(idx: number) {
    setForm((f) => ({ ...f, ragSources: f.ragSources.filter((_, i) => i !== idx) }));
  }

  async function handleSave() {
    if (!server || !token) return;
    if (!form.name.trim()) {
      setFormError('Dê um nome ao agente.');
      return;
    }
    if (!form.model.trim()) {
      setFormError('Escolha um modelo ou combo.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const agent: AgentUIAgent = {
        id: form.id,
        name: form.name.trim(),
        personality: form.personality.trim(),
        model: form.model.trim(),
        channels: form.telegramEnabled ? [{ type: 'telegram' }] : [],
        commandTriggers: form.commandTriggers.trim() ? form.commandTriggers.trim().split(/\s+/) : ['!'],
        ragSources: form.ragSources.filter((s) => s.label.trim() && s.value.trim()),
        guardrails: { enabled: form.guardrailsEnabled, level: form.guardrailsLevel },
        enabled: form.enabled,
      };
      await saveAgentUIAgent(server, token, agent);
      setIsNewAgent(false);
      setShowForm(false);
      await reload(server, token);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Falha ao salvar agente.');
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

        {agents === null ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={theme.accent} />
        ) : agents.length === 0 ? (
          <EmptyState
            icon="chatbubbles-outline"
            title="Nenhum agente ainda"
            subtitle="Crie um agente conversacional com personalidade, modelo e fontes de conhecimento próprias."
          />
        ) : (
          <Section title={agents.length === 1 ? '1 agente' : `${agents.length} agentes`}>
            {agents.map((agent, i) => {
              const enabled = isAgentUIEnabled(agent);
              return (
                <Row
                  key={agent.id}
                  icon="chatbubbles-outline"
                  iconColor={enabled ? '#5856d6' : theme.textFaint}
                  title={agent.name}
                  subtitle={`${agent.model}${agent.channels?.some((c) => c.type === 'telegram') ? ' · Telegram' : ''}${
                    enabled ? '' : ' · Desativado'
                  }`}
                  onPress={() => handleRowPress(agent)}
                  accessory={
                    <Switch
                      value={enabled}
                      onValueChange={(v) => toggleAgentEnabled(agent, v)}
                      trackColor={{ true: theme.accent, false: theme.border }}
                    />
                  }
                  last={i === agents.length - 1}
                />
              );
            })}
          </Section>
        )}
      </ScrollView>

      <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + 20 }]} onPress={openNew} accessibilityLabel="Novo agente">
        <Ionicons name="add" size={28} color={theme.accentText} />
      </TouchableOpacity>

      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowForm(false)}>
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalGrabber} />
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={styles.formTitleRow}>
                <Text style={styles.modalTitle}>{isNewAgent ? 'Novo agente' : 'Editar agente'}</Text>
                {!isNewAgent && (
                  <TouchableOpacity style={styles.testBtn} onPress={() => openSandbox(form.id)}>
                    <Ionicons name="play-circle-outline" size={16} color={theme.accent} style={{ marginRight: 4 }} />
                    <Text style={styles.testBtnText}>Testar</Text>
                  </TouchableOpacity>
                )}
              </View>

              {formError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorTextInModal}>{formError}</Text>
                </View>
              )}

              <View style={styles.switchRow}>
                <Text style={styles.label}>Agente ativo</Text>
                <Switch
                  value={form.enabled}
                  onValueChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
                  trackColor={{ true: theme.accent, false: theme.border }}
                />
              </View>

              <Text style={styles.label}>Nome</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="Ex.: Assistente de suporte"
                placeholderTextColor={theme.placeholder}
              />

              <Text style={styles.label}>Personalidade (prompt de sistema)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.personality}
                onChangeText={(v) => setForm((f) => ({ ...f, personality: v }))}
                placeholder="Como esse agente deve se comportar…"
                placeholderTextColor={theme.placeholder}
                multiline
              />

              <Text style={styles.label}>Modelo</Text>
              <TouchableOpacity style={styles.input} onPress={() => setShowModelPicker(true)}>
                <Text style={form.model ? styles.modelPickedText : styles.modelPlaceholderText}>
                  {form.model || 'Toque para escolher modelo ou combo'}
                </Text>
              </TouchableOpacity>

              <View style={styles.switchRow}>
                <Text style={styles.label}>Canal Telegram</Text>
                <Switch
                  value={form.telegramEnabled}
                  onValueChange={(v) => setForm((f) => ({ ...f, telegramEnabled: v }))}
                  trackColor={{ true: theme.accent, false: theme.border }}
                />
              </View>
              {form.telegramEnabled && (
                <>
                  <Text style={styles.label}>Gatilhos de comando (separados por espaço)</Text>
                  <TextInput
                    style={styles.input}
                    value={form.commandTriggers}
                    onChangeText={(v) => setForm((f) => ({ ...f, commandTriggers: v }))}
                    placeholder="!"
                    placeholderTextColor={theme.placeholder}
                    autoCapitalize="none"
                  />
                </>
              )}

              <Text style={styles.label}>Fontes de conhecimento (RAG simples)</Text>
              {form.ragSources.map((s, idx) => (
                <View key={s.id} style={styles.ragRow}>
                  <View style={styles.segmented}>
                    {(['text', 'url'] as const).map((kind) => {
                      const active = s.kind === kind;
                      return (
                        <TouchableOpacity
                          key={kind}
                          style={[styles.segment, active && styles.segmentActive]}
                          onPress={() => updateRagSource(idx, { kind })}
                        >
                          <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                            {kind === 'text' ? 'Texto' : 'URL'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <TextInput
                    style={[styles.input, { marginTop: 6 }]}
                    value={s.label}
                    onChangeText={(v) => updateRagSource(idx, { label: v })}
                    placeholder="Rótulo (ex.: FAQ)"
                    placeholderTextColor={theme.placeholder}
                  />
                  <TextInput
                    style={[styles.input, s.kind === 'text' && styles.textArea, { marginTop: 6 }]}
                    value={s.value}
                    onChangeText={(v) => updateRagSource(idx, { value: v })}
                    placeholder={s.kind === 'url' ? 'https://…' : 'Cole o texto aqui'}
                    placeholderTextColor={theme.placeholder}
                    multiline={s.kind === 'text'}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity style={styles.removeRagBtn} onPress={() => removeRagSource(idx)}>
                    <Ionicons name="trash-outline" size={16} color={theme.danger} style={{ marginRight: 6 }} />
                    <Text style={styles.removeRagBtnText}>Remover fonte</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.addRowBtn} onPress={addRagSource}>
                <Ionicons name="add-circle-outline" size={18} color={theme.accent} style={{ marginRight: 6 }} />
                <Text style={styles.addRowBtnText}>Adicionar fonte</Text>
              </TouchableOpacity>

              <View style={styles.switchRow}>
                <Text style={styles.label}>Guardrails (proteção contra prompt injection)</Text>
                <Switch
                  value={form.guardrailsEnabled}
                  onValueChange={(v) => setForm((f) => ({ ...f, guardrailsEnabled: v }))}
                  trackColor={{ true: theme.accent, false: theme.border }}
                />
              </View>
              {form.guardrailsEnabled && (
                <View style={styles.segmented}>
                  {(['basic', 'strict'] as const).map((lvl) => {
                    const active = form.guardrailsLevel === lvl;
                    return (
                      <TouchableOpacity
                        key={lvl}
                        style={[styles.segment, active && styles.segmentActive]}
                        onPress={() => setForm((f) => ({ ...f, guardrailsLevel: lvl }))}
                      >
                        <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                          {lvl === 'basic' ? 'Básico' : 'Estrito'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

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
              {combos.length > 0 && (
                <>
                  <Text style={styles.pickerGroupLabel}>Combos</Text>
                  {combos.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={styles.catalogRow}
                      onPress={() => {
                        setForm((f) => ({ ...f, model: `combo:${c.id}` }));
                        setShowModelPicker(false);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.catalogName}>{c.name}</Text>
                        <Text style={styles.catalogSubtitle}>{c.models.length} modelos, com failover</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}
              <Text style={styles.pickerGroupLabel}>Modelos</Text>
              {providers.map((p) =>
                Object.values(p.models).map((m: Model) => (
                  <TouchableOpacity
                    key={`${p.id}-${m.id}`}
                    style={styles.catalogRow}
                    onPress={() => {
                      setForm((f) => ({ ...f, model: `${p.id}/${m.id}` }));
                      setShowModelPicker(false);
                    }}
                  >
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

      <Modal visible={showSandbox} transparent animationType="slide" onRequestClose={() => setShowSandbox(false)}>
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.sandboxSheet}
          >
            <View style={styles.modalGrabber} />
            <View style={styles.sandboxHeader}>
              <Text style={styles.modalTitle}>Testar agente</Text>
              <TouchableOpacity onPress={() => setShowSandbox(false)}>
                <Ionicons name="close" size={22} color={theme.textDim} />
              </TouchableOpacity>
            </View>

            {projects.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.projectPicker}>
                {projects.map((p) => (
                  <TouchableOpacity
                    key={p.path}
                    style={[styles.projectChip, sandboxDirectory === p.path && styles.projectChipActive]}
                    onPress={() => setSandboxDirectory(p.path)}
                  >
                    <Text
                      style={[styles.projectChipText, sandboxDirectory === p.path && styles.projectChipTextActive]}
                      numberOfLines={1}
                    >
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <ScrollView style={styles.sandboxMessages} contentContainerStyle={{ gap: 10, paddingVertical: 8 }}>
              {sandboxMessages.length === 0 && (
                <Text style={styles.sandboxEmptyText}>
                  Manda uma mensagem pra testar a personalidade, o RAG e os guardrails desse agente — sem tocar em
                  nenhum canal real.
                </Text>
              )}
              {sandboxMessages.map((m, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.sandboxBubble,
                    m.role === 'user' ? styles.sandboxBubbleUser : styles.sandboxBubbleAgent,
                    m.blocked && styles.sandboxBubbleBlocked,
                  ]}
                >
                  {m.blocked && (
                    <View style={styles.sandboxBlockedTag}>
                      <Ionicons name="shield-outline" size={12} color={theme.danger} />
                      <Text style={styles.sandboxBlockedTagText}>Bloqueado pelos guardrails</Text>
                    </View>
                  )}
                  <Text style={m.role === 'user' ? styles.sandboxBubbleTextUser : styles.sandboxBubbleTextAgent}>
                    {m.text}
                  </Text>
                </View>
              ))}
              {sandboxSending && <ActivityIndicator color={theme.accent} style={{ marginTop: 4 }} />}
            </ScrollView>

            {sandboxError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorTextInModal}>{sandboxError}</Text>
              </View>
            )}

            <View style={styles.sandboxInputRow}>
              <TextInput
                style={[styles.input, styles.sandboxInput]}
                value={sandboxInput}
                onChangeText={setSandboxInput}
                placeholder="Mensagem de teste…"
                placeholderTextColor={theme.placeholder}
                editable={!sandboxSending}
                onSubmitEditing={handleSendSandboxMessage}
              />
              <TouchableOpacity
                style={[styles.sandboxSendBtn, (!sandboxInput.trim() || sandboxSending) && styles.saveBtnDisabled]}
                onPress={handleSendSandboxMessage}
                disabled={!sandboxInput.trim() || sandboxSending}
              >
                <Ionicons name="send" size={18} color={theme.accentText} />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
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
    formTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    testBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.bgAlt,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      marginBottom: 12,
    },
    testBtnText: { fontSize: 13, fontWeight: '600', color: theme.accent },
    sandboxSheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 20,
      height: '75%',
    },
    sandboxHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    projectPicker: { flexGrow: 0, marginBottom: 8 },
    projectChip: {
      backgroundColor: theme.bgAlt,
      borderRadius: 16,
      paddingVertical: 6,
      paddingHorizontal: 12,
      marginRight: 8,
      maxWidth: 160,
    },
    projectChipActive: { backgroundColor: theme.accent },
    projectChipText: { fontSize: 12, color: theme.textDim, fontWeight: '600' },
    projectChipTextActive: { color: theme.accentText },
    sandboxMessages: { flex: 1 },
    sandboxEmptyText: { fontSize: 13, color: theme.textDim, textAlign: 'center', marginTop: 20, lineHeight: 18 },
    sandboxBubble: { maxWidth: '85%', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12 },
    sandboxBubbleUser: { alignSelf: 'flex-end', backgroundColor: theme.accent },
    sandboxBubbleAgent: { alignSelf: 'flex-start', backgroundColor: theme.bgAlt },
    sandboxBubbleBlocked: { borderWidth: 1, borderColor: theme.danger },
    sandboxBlockedTag: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 4 },
    sandboxBlockedTagText: { fontSize: 11, color: theme.danger, fontWeight: '600' },
    sandboxBubbleTextUser: { fontSize: 14, color: theme.accentText },
    sandboxBubbleTextAgent: { fontSize: 14, color: theme.text },
    sandboxInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 },
    sandboxInput: { flex: 1 },
    sandboxSendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
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
    textArea: { minHeight: 80, textAlignVertical: 'top' },
    modelPickedText: { fontSize: 15, color: theme.text },
    modelPlaceholderText: { fontSize: 15, color: theme.placeholder },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 14,
    },
    ragRow: {
      backgroundColor: theme.bgAlt,
      borderRadius: 10,
      padding: 10,
      marginBottom: 10,
    },
    removeRagBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 8, alignSelf: 'flex-start' },
    removeRagBtnText: { fontSize: 13, color: theme.danger, fontWeight: '600' },
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
    formBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20 },
    cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: theme.bgAlt },
    cancelBtnText: { fontSize: 14, fontWeight: '600', color: theme.textDim },
    saveBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, backgroundColor: theme.accent },
    saveBtnDisabled: { backgroundColor: theme.accentDim },
    saveBtnText: { fontSize: 14, fontWeight: '600', color: theme.accentText },
    pickerGroupLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
      marginTop: 10,
      marginBottom: 4,
    },
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
