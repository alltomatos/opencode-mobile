# ADR 0001: Arquitetura do Cliente Mobile, UI/UX e Governança

- **Status**: Aceito
- **Data**: 2026-09-07
- **Autores**: Orquestrador & Equipe de Engenharia OpenCode

---

## Contexto e Problema

O projeto `opencode_mobile` foi criado para prover um aplicativo móvel nativo capaz de operar com o fork `alltomatos/opencode` (incluindo as capacidades exclusivas de Batuta, Memória e Breniac). Apps de terceiros existentes suportam apenas a API padrão do OpenCode e não oferecem recursos de acessibilidade por voz nem orquestração avançada.

---

## Decisões Arquiteturais

### 1. Framework & Runtime
- **Tecnologia**: React Native com Expo SDK 57 e TypeScript.
- **Roteamento**: Expo Router (navegação declarativa baseada no sistema de arquivos em `app/`).
- **Target**: Android e iOS.

### 2. Design System & Interface
- **Estilo**: Inspiração no iOS Human Interface Guidelines (HIG) da Apple.
- **Componentização**: Uso padronizado dos componentes compartilhados em `src/components/ui/` (`Section`, `Row`, `PrimaryButton`, `EmptyState`, `PromptModal`).
- **Navegação Raiz**: Lista de servidores em `app/index.tsx` sem Tab Bar inferior. A navegação contextual por servidor ocorre em `app/server/[id]/`.
- **Higiene Visual**: Zero emojis na interface do aplicativo — utilização estrita da biblioteca `Ionicons` (`@expo/vector-icons`).

### 3. Integração com Servidor
- **Protocolo**: HTTP REST + Server-Sent Events (SSE) via `src/lib/api.ts`.
- **Autenticação**: HTTP Basic Auth e `auth_token` query param. Armazenamento seguro de credenciais com `expo-secure-store`.
- **N servidores pareados**: Suporte a múltiplos servidores cadastrados, com pareamento por QR Code.

### 4. Governança do Código
- **Rastreabilidade**: GitHub Issues (`alltomatos/opencode-mobile`) como Fonte Única da Verdade.
- **Validação de Qualidade**: `npx tsc --noEmit` e `npx expo-doctor` obrigatórios antes de merges.

---

## Consequências

- **Positivas**: Interface coesa e profissional, paridade total com o servidor fork, acessibilidade aprimorada, facilidade de manutenção.
- **Desafios**: Necessidade de rigor na manutenção dos contratos da API do servidor e validação constante em dispositivos nativos.
