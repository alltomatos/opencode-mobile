# DEVELOPER-ROADMAP — Plano Estratégico do OpenCode Mobile

> Mapa de longo prazo do repositório `opencode_mobile`. Cada Epic é vinculado a uma Issue oficial no GitHub.

---

## Epics

- [x] [**[E01] Fundação do App Mobile, Conexão Multisservidores & Importador de Projetos**](https://github.com/alltomatos/opencode-mobile/issues/1) — `done`
  - Estrutura Expo SDK 57, Expo Router, SecureStore multisservidores, leitor de QR Code, listagem e importação de projetos via `/home/opencode/projects`.
- [x] [**[E02] Composer Completo e Experiência de Chat Paritária**](https://github.com/alltomatos/opencode-mobile/issues/2) — `done`
  - Anexo de imagem (câmera/galeria base64), seletor de modelos, modos de execução (`build`/`plan`/auto-reply), autocomplete de comandos `/` e adição de provedores (OAuth/API Key).
- [x] [**[E03] Módulo Batuta Mobile — Orquestração Multi-agente**](https://github.com/alltomatos/opencode-mobile/issues/3) — `done`
  - Visualização de atividades Batuta (`GET /batuta`), criação/exclusão, tela de detalhes e ações de delegação orquestrador → worker (`start`, `delegate`, `dispatch`).
- [x] [**[E04] Módulo de Memória Cross-Sessão & Configurações Avançadas**](https://github.com/alltomatos/opencode-mobile/issues/4) — `done`
  - Gerenciamento de memória por projeto (`/memory/project`), seletor de modelo de memória e edição de parâmetros do servidor (`GET/PATCH /config`).
- [x] [**[E05] Sandbox de Teste In-App (WebView WebGPU/WebGL2)**](https://github.com/alltomatos/opencode-mobile/issues/5) — `done`
  - Componente WebView com WebGPU/WebGL2 para executar jogos 3D e aplicações web geradas pelo agente direto no celular.
- [ ] [**[E06] Breniac Mobile — Assistente de Voz em Tempo Real & Acessibilidade Total**](https://github.com/alltomatos/opencode-mobile/issues/6) — `todo`
  - Interface por voz duplex em tempo real (Breniac) com acessibilidade 100% acionável por voz para pessoas com tetraplegia.
- [x] [**[E07] Rotinas / Agendamentos (Schedules) Mobile**](https://github.com/alltomatos/opencode-mobile/issues/16) — `done`
  - Portar módulo inicial de Rotinas (agendamentos de shell, instruções de agente e MCP tools), visualização, disparo manual sob demanda e criação no celular.
- [x] [**[E08] Sincronização em Tempo Real SSE V2 & Streaming de Sessões**](https://github.com/alltomatos/opencode-mobile/issues/22) — `done`
  - Consumo reativo de eventos SSE (`GET /event`), streaming de reasoning e tool parts, reconexão resiliente e sincronização de modelo/agente da sessão ativa.
- [x] [**[E09] Rotinas V2 (Quando / Como / Por Onde) & Suporte a Skills/MCP**](https://github.com/alltomatos/opencode-mobile/issues/23) — `done`
  - Atualização para o novo motor de rotinas V2 com múltiplos horários, cron OR, ações de prompt/skill/mcp_tool e auto-cura por timeout.
- [x] [**[E10] Provedores E18, Combos Especialistas & Raciocínio Estendido**](https://github.com/alltomatos/opencode-mobile/issues/24) — `done`
  - Suporte a Combos com cadeias de prioridade/fallback, visualização de cotas/cooldown multi-contas (AGY/Kiro) e controle de raciocínio estendido.
- [x] [**[E11] AgentUI Audit Logs & Monitoramento Batuta Live**](https://github.com/alltomatos/opencode-mobile/issues/25) — `done`
  - Visualização de logs de auditoria WhatsApp (izapia) e Telegram, com monitoramento dos workers do Batuta.

---

## Milestones

### Milestone 1: Cliente Remoto Paritário (v1.0)
- **Foco**: Conexão estável, navegação em projetos, composer completo e suporte a Batuta.
- **Epics associados**: [E01], [E02], [E03], [E04]
- **Status**: `done`

### Milestone 2: Experiência Imersiva & Acessibilidade (v2.0)
- **Foco**: Sandbox WebGPU/WebGL2 in-app, assistente de voz Breniac e automação com Rotinas.
- **Epics associados**: [E05], [E06], [E07]
- **Status**: `in_progress`

### Milestone 3: Sincronização em Tempo Real & Provedores V2 (v3.0)
- **Foco**: SSE V2 reativo, Rotinas Quando/Como/Por Onde, Combos E18 e Auditoria AgentUI.
- **Epics associados**: [E08], [E09], [E10], [E11]
- **Status**: `done`
