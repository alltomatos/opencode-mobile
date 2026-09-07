# AGENTS.md — Governança e Instruções para Agentes

> Este repositório é o cliente mobile nativo (Expo / React Native) do fork **OpenCode + Batuta + Breniac** (`alltomatos/opencode-mobile`).

---

##Visão Geral do Projeto

App mobile de controle e orquestração para o ecossistema OpenCode. Permite conectar a servidores OpenCode (remotos via VPS/HTTP ou em rede local/Tailscale), gerenciar projetos, conduzir sessões de chat/instrução com agentes de IA, aceitar permissões, parear via QR Code e interagir com funcionalidades exclusivas do fork (Batuta, Memória e Breniac).

- **Stack Principal**: React Native, Expo SDK 57, TypeScript, Expo Router (file-based routing).
- **Estilo & UI/UX**: Design system inspirado na Apple (iOS HIG) — paleta `systemBlue`/`systemGroupedBackground`, tabelas agrupadas (`Section` + `Row`), zero emoji (apenas `Ionicons`), componentes reutilizáveis em `src/components/ui/`.
- **Comunicação com Backend**: HTTP REST + SSE (`GET /event`) em `src/lib/api.ts`.
- **Rastreabilidade & Issues**: GitHub Issues (`alltomatos/opencode-mobile`).

---

## Regras Arquiteturais e Golden Rules

1. **Nunca adivinhe a API do Servidor**: Rotas, campos e contratos devem ser verificados em `D:\dev\opencode\packages\opencode\src` ou testados com servidor real. Exemplo: `model.modelID` (não `model.id`), `/session` sem `directory` devolve o projeto errado, `POST /session/:id/shell` responde 200 mesmo se o comando falhar.
2. **Componentes de UI Padronizados**: Sempre utilize `Section`, `Row`, `PrimaryButton`, `EmptyState`, `PromptModal` de `src/components/ui/`. Nunca crie telas do zero com `View` e `Text` avulsos estilizados manualmente.
3. **Zero Emoji na Interface**: A interface deve usar estritamente ícones nativos `Ionicons` (`@expo/vector-icons`).
4. **Sem Tab Bar na Raiz**: A tela inicial (`app/index.tsx`) é a lista de servidores pareados. A navegação secundária e hubs (`Code`, `Batuta`, `Configurações`) são escopados por servidor (`app/server/[id]/`).
5. **Verificação de Tipos e Qualidade**: Toda alteração deve passar em `npx tsc --noEmit` e `npx expo-doctor` sem erros antes de ser considerada concluída.
6. **Ações Destrutivas**: Remoção de servidor, sessão ou projeto exige confirmação com `Alert.alert` (estilo `destructive`) e deve ficar isolada em seção própria.

---

## Agent Skills

As seguintes skills estão disponíveis para auxiliar no desenvolvimento e manutenção do projeto:

- `opencode-mobile-expert`: Conhecimento profundo da arquitetura do app mobile, gotchas da API do servidor, design system iOS, bugs conhecidos e workflows de desenvolvimento.
- `expo-expert`: Conhecimento especializado de Expo SDK 57, Expo Router, EAS, config plugins, resolução de problemas no Android/iOS e Metro bundler.
- `opencode-fork-expert`: Especialista no ecossistema do servidor fork OpenCode, incluindo rotas de Batuta, Breniac, Memory e integração HTTP/SSE.
- `orchestrator`: Governança central, planejamento de DAGs, execução fatiada e auditoria.
- `setup-skills`: Provisionamento documental e governança inicial de repositório.
- `roadmap`: Gestão de roadmap operacional e acompanhamento de épicos.
- `grill-with-docs`: Consolidação de requisitos e alinhamento de linguagem de domínio.
- `tdd`: Implementação orientada a testes para lógica TypeScript e utilitários.
- `diagnose`: Investigação de causas-raiz em falhas de compilação, bugs de UI ou erros de API.
- `qa-analyst`: Análise de qualidade, verificação de critérios de aceite e auditoria pré-PR.
- `to-issues`: Fatiamento de demandas e criação de Issues rastreáveis no GitHub.
