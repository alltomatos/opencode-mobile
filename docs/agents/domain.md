# Vocabulário e Conceitos do Domínio (OpenCode Mobile)

Este documento centraliza os termos e conceitos de domínio utilizados no projeto `opencode_mobile`.

---

## Termos Principais

### Servidor Pareado (`ServerConnection`)
Um servidor remoto ou em rede local executando o fork `opencode` (instância com `OPENCODE_SERVER_PASSWORD`). Cada servidor é identificado por sua URL, tipo de conexão (`http`), e credencial de autenticação (`auth_token` ou `base64(usuario:senha)`) salva de forma segura no dispositivo via `SecureStore`.

### Pareamento por QR Code
Mecanismo de integração rápida onde o app desktop gera um QR Code contendo a URL e o token de autenticação do servidor (`{ v: 1, url, token, label }`). O app mobile lê o QR Code via câmera, valida a conexão (`GET /instance`) e salva o novo servidor pareado.

### Hub do Servidor
A interface principal do app quando um servidor específico está selecionado (`app/server/[id]/`). Contém navegação por abas/seções entre **Code** (Sessões/Projetos), **Batuta** (Atividades multi-agente) e **Configurações**.

### Sessão (`Session`)
Uma thread de conversa/instrução de desenvolvimento associada a um diretório de projeto específico (`directory`). As mensagens trocadas em uma sessão podem disparar ferramentas (tool calls), comandos de shell, edições de arquivos e solicitações de permissão.

### Batuta
Módulo de orquestração multi-agente exclusivo do fork `opencode`. Permite visualizar atividades de desenvolvimento, delegar tarefas entre agente orquestrador e agentes trabalhadores (workers) e acompanhar a execução em tempo real.

### Breniac
Assistente de voz em tempo real mobile-first exclusivo do fork `opencode`. Focado em acessibilidade total (incluindo usuários com tetraplegia), permitindo operar o ciclo de desenvolvimento por comandos de voz duplex.

### Composer
Barra de entrada de prompt e anexos no chat de sessão. Suporta envio de texto, anexos de imagem (via `data:` URL base64), seletor de modelo (`providerID`/`modelID`), seleção de modo de execução (Manual, Aceitar Edições, Planejar, Automático) e autocompletar de comandos/skills via `/`.

### EventStream / SSE (`GET /event`)
Canal de comunicação Server-Sent Events que transmite atualizações reativas do servidor para o app móvel em tempo real (progresso de geração, perguntas `question.asked`, permissões `permission.asked`, mudanças de estado).

### Design System Apple / iOS HIG
Padrão de design adotado no aplicativo: tabelas com cantos arredondados (`Section` e `Row`), agrupamento em cartões, cores do sistema (`systemBlue`, `systemGroupedBackground`), tipografia clara e ausência total de emojis na UI (utilizando apenas `Ionicons`).
