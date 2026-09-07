# CONTEXT.md — Mapa de Contexto da Codebase

## Estrutura do Repositório

```text
opencode_mobile/
├── app/                        # Rotas do Expo Router (Navegação baseada em arquivos)
│   ├── index.tsx              # Lista de Servidores Pareados (Home sem tab bar)
│   ├── _layout.tsx            # Root Stack Navigator & Providers
│   ├── add-server.tsx         # Adição / Pareamento de Servidor (QR Code ou URL/Token)
│   └── server/[id]/           # Hub por Servidor Pareado
│       ├── _layout.tsx        # Layout escopado do Servidor
│       ├── index.tsx          # Visão Code (Sessões / Projetos)
│       ├── batuta.tsx         # Visão Batuta (Atividades & Delegação)
│       └── settings.tsx       # Configurações do Servidor
├── assets/                     # Imagens, fontes e splash screen
├── docs/                       # Documentação do projeto
│   ├── agents/                # Rastreabilidade, etiquetas e domínio de agentes
│   ├── adr/                   # Decisões de Arquitetura (ADRs)
│   ├── prd/                   # PRDs (mobile-app.md, mobile-api-reference.md)
│   └── vps-hosting.md         # Guia de hospedagem em VPS
├── src/                        # Código-fonte da aplicação
│   ├── components/            # Componentes React Native
│   │   ├── ui/                # UI Design System (Section, Row, PrimaryButton, etc.)
│   │   └── ActivityParts.tsx  # Cards de ferramentas, reasoning e thinking do chat
│   ├── lib/                   # Módulos de lógica, storage e API
│   │   ├── api.ts             # Cliente HTTP + SSE para comunicação com o servidor
│   │   ├── servers.ts         # Gerenciamento de servidores pareados (SecureStore)
│   │   ├── settings.ts        # Preferências locais (AsyncStorage)
│   │   └── theme.ts           # Design tokens e paleta de cores (iOS System Light/Dark)
│   └── types/                 # Definições de tipos TypeScript
├── app.json                    # Configuração do Expo / App Manifest
├── package.json                # Dependências e scripts npm
└── tsconfig.json               # Configuração do TypeScript
```

---

## Fluxo Principal de Dados e Navegação

1. **Abertura do App (`app/index.tsx`)**: Carrega a lista de servidores pareados via `src/lib/servers.ts` (armazenados com criptografia em `SecureStore`).
2. **Seleção de Servidor (`app/server/[id]/_layout.tsx`)**: Define o servidor ativo no contexto e abre o Hub do Servidor com acesso a **Code**, **Batuta** e **Configurações**.
3. **Gerenciamento de Projetos e Sessões**:
   - As subpastas de `/home/opencode/projects` são listadas via `GET /file?directory=/home/opencode/projects&path=.` (filtrando por diretório).
   - As sessões são consultadas via `GET /session` filtradas por `directory`.
4. **Execução de Chat & Streaming**:
   - prompts enviados via `POST /session/:id/prompt_async` ou `POST /session/:id/message`.
   - Eventos em tempo real (progresso, permissões `permission.asked`, perguntas `question.asked`) chegam via SSE (`GET /event`).

---

## Convenções de Código e Padrões de Design

- **UI System**: Uso obrigatório dos componentes em `src/components/ui/` (`Section`, `Row`, `PrimaryButton`, `EmptyState`, `PromptModal`).
- **Cores & Temas**: Utilizar tokens de `src/lib/theme.ts`. Suporte a modo claro/escuro via `useColorScheme`.
- **Ícones**: Estritamente `Ionicons` de `@expo/vector-icons`.
- **Validação de Tipos**: TypeScript estrito. Tipos de API derivados das respostas reais do servidor.
- **Tratamento de Erros**: Feedback visual consistente ao usuário (modais/alerts) e timeouts explícitos em operações de rede.
