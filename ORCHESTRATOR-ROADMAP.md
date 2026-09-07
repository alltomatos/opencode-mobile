# ORCHESTRATOR-ROADMAP — Plano Estratégico

> Mapa de longo prazo do repositório `opencode_mobile`. Cada Epic é vinculado a uma Issue oficial no GitHub.

---

## Epics

- [x] [**[E01] Fundação do App Mobile, Conexão Multisservidores & Importador de Projetos**](https://github.com/alltomatos/opencode-mobile/issues/1) — `done`
  - Estrutura Expo SDK 57, Expo Router, SecureStore multisservidores, leitor de QR Code, listagem e importação de projetos via `/home/opencode/projects`.
- [x] [**[E02] Composer Completo e Experiência de Chat Paritária**](https://github.com/alltomatos/opencode-mobile/issues/2) — `done`
  - Anexo de imagem (câmera/galeria base64), seletor de modelos, modos de execução (`build`/`plan`/auto-reply), autocomplete de comandos `/` e adição de provedores (OAuth/API Key).
- [ ] [**[E03] Módulo Batuta Mobile — Orquestração Multi-agente**](https://github.com/alltomatos/opencode-mobile/issues/3) — `todo`
  - Visualização de atividades Batuta (`GET /batuta`), acompanhamento de status em tempo real via SSE e ação de delegação orquestrador → worker.
- [ ] [**[E04] Módulo de Memória Cross-Sessão & Configurações Avançadas**](https://github.com/alltomatos/opencode-mobile/issues/4) — `todo`
  - Gerenciamento de memória cross-sessão global e por projeto (`/memory`) e ajuste de parâmetros de configuração do servidor (`/config`).
- [ ] [**[E05] Sandbox de Teste In-App (WebView WebGPU/WebGL2)**](https://github.com/alltomatos/opencode-mobile/issues/5) — `todo`
  - Componente WebView com WebGPU/WebGL2 para executar jogos 3D e aplicações web geradas pelo agente direto no celular.
- [ ] [**[E06] Breniac Mobile — Assistente de Voz em Tempo Real & Acessibilidade Total**](https://github.com/alltomatos/opencode-mobile/issues/6) — `todo`
  - Interface por voz duplex em tempo real (Breniac) com acessibilidade 100% acionável por voz para pessoas com tetraplegia.

---

## Milestones

### Milestone 1: Cliente Remoto Paritário (v1.0)
- **Foco**: Conexão estável, navegação em projetos, composer completo e suporte a Batuta.
- **Epics associados**: [E01], [E02], [E03], [E04]
- **Status**: `in_progress`

### Milestone 2: Experiência Imersiva & Acessibilidade (v2.0)
- **Foco**: Sandbox WebGPU/WebGL2 in-app e assistente de voz Breniac mobile-first.
- **Epics associados**: [E05], [E06]
- **Status**: `todo`
