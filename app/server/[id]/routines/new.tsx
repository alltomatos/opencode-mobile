import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  createSchedule,
  getMcpCatalog,
  listAllProjects,
  listMcpStatus,
  ProjectFolder,
  ScheduleAction,
  ScheduleCreateInput,
  ScheduleTrigger,
  SkillMcpTool,
} from '../../../../src/lib/api';
import { getServerToken, listServers, ServerConnection } from '../../../../src/lib/servers';
import { Theme, useTheme } from '../../../../src/lib/theme';

type TriggerKind = 'daily' | 'interval' | 'cron' | 'manual';
type ActionKind = 'skill' | 'shell' | 'mcp_tool';
type IntervalUnit = 'minutes' | 'hours';
type PermissionMode = 'auto' | 'bypass' | 'default';

export default function NewRoutineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = createStyles(theme);

  const [server, setServer] = useState<ServerConnection | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectFolder[]>([]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const [triggerKind, setTriggerKind] = useState<TriggerKind>('daily');
  const [dailyHour, setDailyHour] = useState('09');
  const [dailyMinute, setDailyMinute] = useState('00');
  const [intervalAmount, setIntervalAmount] = useState('30');
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>('minutes');
  const [cronExpr, setCronExpr] = useState('0 9 * * 1-5');

  const [actionKind, setActionKind] = useState<ActionKind>('skill');
  const [instructions, setInstructions] = useState('');
  const [shellCommand, setShellCommand] = useState('');
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('auto');

  const [availableMcpTools, setAvailableMcpTools] = useState<{ server: string; tool: string; desc?: string }[]>([]);
  const [selectedMcpTools, setSelectedMcpTools] = useState<SkillMcpTool[]>([]);
  const [selectedSingleMcp, setSelectedSingleMcp] = useState<string>('');
  const [mcpArgsJson, setMcpArgsJson] = useState('');
  const [loadingMcp, setLoadingMcp] = useState(false);

  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listServers().then(async (list) => {
      const found = list.find((s) => s.id === id) ?? null;
      setServer(found);
      if (!found) return;
      const t = await getServerToken(found.id);
      setToken(t);
      if (!t) return;

      listAllProjects(found, t)
        .then(setProjects)
        .catch(() => {});

      setLoadingMcp(true);
      try {
        const mcpMap = await listMcpStatus(found, t);
        const connectedServers = Object.entries(mcpMap)
          .filter(([, val]) => val.status === 'connected')
          .map(([sName]) => sName);

        const toolsList: { server: string; tool: string; desc?: string }[] = [];
        for (const sName of connectedServers) {
          try {
            const cat = await getMcpCatalog(found, t, sName);
            for (const tItem of cat.tools) {
              toolsList.push({ server: sName, tool: tItem.name, desc: tItem.description });
            }
          } catch {}
        }
        setAvailableMcpTools(toolsList);
        if (toolsList.length > 0) {
          setSelectedSingleMcp(toolsList[0].server + '/' + toolsList[0].tool);
        }
      } catch {} finally {
        setLoadingMcp(false);
      }
    });
  }, [id]);

  function toggleMcpTool(toolRef: SkillMcpTool) {
    setSelectedMcpTools((prev) => {
      const exists = prev.some((t) => t.server === toolRef.server && t.tool === toolRef.tool);
      if (exists) {
        return prev.filter((t) => !(t.server === toolRef.server && t.tool === toolRef.tool));
      }
      return [...prev, toolRef];
    });
  }

  function isMcpToolSelected(toolRef: SkillMcpTool) {
    return selectedMcpTools.some((t) => t.server === toolRef.server && t.tool === toolRef.tool);
  }

  function buildTrigger(): ScheduleTrigger {
    if (triggerKind === 'daily') {
      const h = parseInt(dailyHour, 10) || 0;
      const m = parseInt(dailyMinute, 10) || 0;
      return { kind: 'cron', expr: `${m} ${h} * * *` };
    }
    if (triggerKind === 'interval') {
      const amt = parseInt(intervalAmount, 10) || 1;
      const ms = intervalUnit === 'hours' ? amt * 3600000 : amt * 60000;
      return { kind: 'interval', ms };
    }
    if (triggerKind === 'cron') {
      return { kind: 'cron', expr: cronExpr.trim() || '0 9 * * *' };
    }
    return { kind: 'manual' };
  }

  function buildAction(): ScheduleAction {
    if (actionKind === 'shell') {
      return { kind: 'shell', command: shellCommand.trim() };
    }
    if (actionKind === 'mcp_tool') {
      const [sName, ...rest] = selectedSingleMcp.split('/');
      const tName = rest.join('/');
      let parsedArgs: Record<string, unknown> | undefined;
      if (mcpArgsJson.trim()) {
        try {
          parsedArgs = JSON.parse(mcpArgsJson);
        } catch {}
      }
      return {
        kind: 'mcp_tool',
        server: sName,
        tool: tName,
        args: parsedArgs,
      };
    }
    return {
      kind: 'skill',
      instructions: instructions.trim(),
      permission: permissionMode,
      mcpTools: selectedMcpTools.length > 0 ? selectedMcpTools : undefined,
    };
  }

  const canSave =
    (actionKind === 'shell'
      ? shellCommand.trim().length > 0
      : actionKind === 'mcp_tool'
      ? selectedSingleMcp.length > 0
      : instructions.trim().length > 0) &&
    (triggerKind === 'interval'
      ? parseInt(intervalAmount, 10) > 0
      : triggerKind === 'cron'
      ? cronExpr.trim().length > 0
      : true);

  async function handleSave() {
    if (!server || !token || !canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      const input: ScheduleCreateInput = {
        name: name.trim() || undefined,
        description: description.trim() || undefined,
        trigger: buildTrigger(),
        action: buildAction(),
        workspace: selectedWorkspace ?? undefined,
        enabled: true,
      };

      await createSchedule(server, token, input, selectedWorkspace ?? undefined);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar rotina.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={theme.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* IDENTIFICAÇÃO */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>IDENTIFICAÇÃO (OPCIONAL)</Text>
          <Text style={styles.fieldLabel}>Nome da rotina:</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ex.: Auditoria de Código & Testes"
            placeholderTextColor={theme.placeholder}
          />
          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Descrição:</Text>
          <TextInput
            style={styles.input}
            value={description}
            onChangeText={setDescription}
            placeholder="Ex.: Executa verificação diária e notifica no Discord"
            placeholderTextColor={theme.placeholder}
          />
        </View>

        {/* QUANDO */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>QUANDO EXECUTAR</Text>
          <View style={styles.segmented}>
            {(['daily', 'interval', 'cron', 'manual'] as const).map((kind) => {
              const active = triggerKind === kind;
              const label =
                kind === 'daily'
                  ? 'Todo dia'
                  : kind === 'interval'
                  ? 'A cada'
                  : kind === 'cron'
                  ? 'Cron'
                  : 'Manual';
              return (
                <TouchableOpacity
                  key={kind}
                  style={[styles.segment, active && styles.segmentActive]}
                  onPress={() => setTriggerKind(kind)}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {triggerKind === 'daily' && (
            <View style={styles.triggerConfigRow}>
              <Text style={styles.fieldLabel}>Horário (24h):</Text>
              <View style={styles.timeInputsRow}>
                <TextInput
                  style={styles.timeInput}
                  value={dailyHour}
                  onChangeText={(v) => setDailyHour(v.replace(/[^0-9]/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="09"
                  placeholderTextColor={theme.placeholder}
                />
                <Text style={styles.timeSeparator}>:</Text>
                <TextInput
                  style={styles.timeInput}
                  value={dailyMinute}
                  onChangeText={(v) => setDailyMinute(v.replace(/[^0-9]/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="00"
                  placeholderTextColor={theme.placeholder}
                />
              </View>
            </View>
          )}

          {triggerKind === 'interval' && (
            <View style={styles.triggerConfigRow}>
              <Text style={styles.fieldLabel}>Intervalo:</Text>
              <View style={styles.intervalRow}>
                <TextInput
                  style={[styles.timeInput, { width: 64 }]}
                  value={intervalAmount}
                  onChangeText={(v) => setIntervalAmount(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="30"
                  placeholderTextColor={theme.placeholder}
                />
                <View style={[styles.segmented, { flex: 1, marginTop: 0 }]}>
                  {(['minutes', 'hours'] as const).map((u) => {
                    const active = intervalUnit === u;
                    return (
                      <TouchableOpacity
                        key={u}
                        style={[styles.segment, active && styles.segmentActive]}
                        onPress={() => setIntervalUnit(u)}
                      >
                        <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                          {u === 'minutes' ? 'minutos' : 'horas'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          )}

          {triggerKind === 'cron' && (
            <View style={styles.triggerConfigRow}>
              <Text style={styles.fieldLabel}>Expressão Cron:</Text>
              <TextInput
                style={[styles.input, styles.monoInput]}
                value={cronExpr}
                onChangeText={setCronExpr}
                placeholder="0 9 * * 1-5"
                placeholderTextColor={theme.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.hintText}>Formato padrão: minuto hora dia mês dia-da-semana</Text>
            </View>
          )}

          {triggerKind === 'manual' && (
            <Text style={styles.hintText}>
              A rotina não terá agendamento automático. Você poderá dispará-la a qualquer momento pelo botão "Rodar".
            </Text>
          )}
        </View>

        {/* COMO / O QUE FAZER */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>O QUE FAZER (COMO)</Text>
          <View style={styles.segmented}>
            {(['skill', 'shell', 'mcp_tool'] as const).map((kind) => {
              const active = actionKind === kind;
              const label =
                kind === 'skill'
                  ? 'Agente IA'
                  : kind === 'shell'
                  ? 'Terminal Shell'
                  : 'Ferramenta MCP';
              return (
                <TouchableOpacity
                  key={kind}
                  style={[styles.segment, active && styles.segmentActive]}
                  onPress={() => setActionKind(kind)}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {actionKind === 'skill' && (
            <View style={styles.actionBody}>
              <Text style={styles.fieldLabel}>Instruções para o agente IA:</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={instructions}
                onChangeText={setInstructions}
                placeholder="Ex.: Verifique os commits recentes e rode a suíte de testes de regressão..."
                placeholderTextColor={theme.placeholder}
                multiline
              />

              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Modo de Permissões:</Text>
              <View style={styles.segmented}>
                {(['auto', 'default', 'bypass'] as const).map((mode) => {
                  const active = permissionMode === mode;
                  const label = mode === 'auto' ? 'Automático' : mode === 'bypass' ? 'Ignorar' : 'Padrão';
                  return (
                    <TouchableOpacity
                      key={mode}
                      style={[styles.segment, active && styles.segmentActive]}
                      onPress={() => setPermissionMode(mode)}
                    >
                      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {availableMcpTools.length > 0 && (
                <View style={styles.mcpSection}>
                  <Text style={styles.fieldLabel}>Ferramentas MCP autorizadas:</Text>
                  <View style={styles.mcpChipGrid}>
                    {availableMcpTools.map((t) => {
                      const selected = isMcpToolSelected(t);
                      return (
                        <TouchableOpacity
                          key={t.server + '/' + t.tool}
                          style={[styles.mcpChip, selected && styles.mcpChipSelected]}
                          onPress={() => toggleMcpTool(t)}
                        >
                          <Ionicons
                            name={selected ? 'checkmark-circle' : 'cube-outline'}
                            size={14}
                            color={selected ? theme.accentText : theme.textDim}
                          />
                          <Text style={[styles.mcpChipText, selected && styles.mcpChipTextSelected]}>
                            {t.server}/{t.tool}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          )}

          {actionKind === 'shell' && (
            <View style={styles.actionBody}>
              <Text style={styles.fieldLabel}>Comando de terminal:</Text>
              <TextInput
                style={[styles.input, styles.monoInput]}
                value={shellCommand}
                onChangeText={setShellCommand}
                placeholder="Ex.: npm test && git status"
                placeholderTextColor={theme.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}

          {actionKind === 'mcp_tool' && (
            <View style={styles.actionBody}>
              <Text style={styles.fieldLabel}>Ferramenta MCP:</Text>
              {availableMcpTools.length === 0 ? (
                <Text style={styles.hintText}>Nenhuma ferramenta MCP conectada no servidor.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.projectScroll}>
                  {availableMcpTools.map((t) => {
                    const key = t.server + '/' + t.tool;
                    const active = selectedSingleMcp === key;
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.projectChip, active && styles.projectChipSelected]}
                        onPress={() => setSelectedSingleMcp(key)}
                      >
                        <Text style={[styles.projectChipText, active && styles.projectChipTextSelected]}>
                          {key}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Argumentos JSON (opcional):</Text>
              <TextInput
                style={[styles.input, styles.monoInput, { height: 72 }]}
                value={mcpArgsJson}
                onChangeText={setMcpArgsJson}
                placeholder='{"query": "status"}'
                placeholderTextColor={theme.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
              />
            </View>
          )}
        </View>

        {/* POR ONDE / PROJETO ALVO */}
        {projects.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>PROJETO ALVO (POR ONDE)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.projectScroll}>
              <TouchableOpacity
                style={[styles.projectChip, selectedWorkspace === null && styles.projectChipSelected]}
                onPress={() => setSelectedWorkspace(null)}
              >
                <Text style={[styles.projectChipText, selectedWorkspace === null && styles.projectChipTextSelected]}>
                  Global (sem pasta)
                </Text>
              </TouchableOpacity>
              {projects.map((p) => {
                const active = selectedWorkspace === p.path;
                return (
                  <TouchableOpacity
                    key={p.path}
                    style={[styles.projectChip, active && styles.projectChipSelected]}
                    onPress={() => setSelectedWorkspace(active ? null : p.path)}
                  >
                    <Text style={[styles.projectChipText, active && styles.projectChipTextSelected]}>
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={styles.footerRow}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()} disabled={saving}>
            <Text style={styles.cancelBtnText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, (!canSave || saving) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={theme.accentText} />
            ) : (
              <Text style={styles.saveBtnText}>Criar rotina</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    scroll: {
      padding: 16,
      gap: 16,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      gap: 12,
    },
    sectionHeader: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textDim,
      letterSpacing: 0.5,
    },
    segmented: {
      flexDirection: 'row',
      backgroundColor: theme.bgAlt,
      borderRadius: 9,
      padding: 3,
      gap: 2,
      marginTop: 4,
    },
    segment: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: 7,
      alignItems: 'center',
    },
    segmentActive: {
      backgroundColor: theme.accent,
    },
    segmentText: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.textDim,
    },
    segmentTextActive: {
      color: theme.accentText,
      fontWeight: '600',
    },
    triggerConfigRow: {
      gap: 8,
      marginTop: 4,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.text,
    },
    timeInputsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    timeInput: {
      backgroundColor: theme.bgAlt,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      textAlign: 'center',
      width: 52,
    },
    timeSeparator: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.textDim,
    },
    intervalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    hintText: {
      fontSize: 12,
      color: theme.textDim,
      lineHeight: 17,
    },
    actionBody: {
      gap: 8,
      marginTop: 4,
    },
    input: {
      backgroundColor: theme.bgAlt,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.text,
    },
    textArea: {
      height: 90,
      textAlignVertical: 'top',
    },
    monoInput: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 13,
    },
    mcpSection: {
      gap: 8,
      marginTop: 6,
    },
    mcpChipGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    mcpChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 7,
      backgroundColor: theme.bgAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    mcpChipSelected: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    mcpChipText: {
      fontSize: 12,
      color: theme.textDim,
    },
    mcpChipTextSelected: {
      color: theme.accentText,
      fontWeight: '600',
    },
    projectScroll: {
      marginTop: 4,
    },
    projectChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: theme.bgAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      marginRight: 8,
    },
    projectChipSelected: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    projectChipText: {
      fontSize: 13,
      color: theme.textDim,
    },
    projectChipTextSelected: {
      color: theme.accentText,
      fontWeight: '600',
    },
    footerRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      alignItems: 'center',
      backgroundColor: theme.surface,
    },
    cancelBtnText: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.text,
    },
    saveBtn: {
      flex: 2,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
      backgroundColor: theme.accent,
    },
    saveBtnDisabled: {
      opacity: 0.5,
    },
    saveBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.accentText,
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.dangerBg,
      padding: 12,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.danger,
    },
    errorText: {
      flex: 1,
      fontSize: 13,
      color: theme.danger,
    },
  });
}
