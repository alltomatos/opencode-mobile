# Convenções de Triage e Labels do GitHub

Este repositório utiliza o conjunto padronizado de labels de triage do framework `alltomatos/skills`:

## Labels de Estado / Triage

| Label | Cor | Descrição |
|---|---|---|
| `needs-triage` | `#FBCA04` | Issue recém-criada aguardando classificação inicial de escopo e prioridade. |
| `needs-info` | `#D93F0B` | Requer esclarecimento humano ou informações adicionais antes de avançar. |
| `ready-for-agent` | `#0E8A16` | Tarefa completamente especificada com critérios de aceite prontos para execução por agente. |
| `ready-for-human` | `#1D76DB` | Requer intervenção humana, revisão ou confirmação explícita (ex.: mudanças de schema/auth). |
| `wontfix` | `#FFFFFF` | Issue rejeitada, fora de escopo ou duplicada. |

## Labels de Prioridade

| Label | Descrição | Exemplo de Aplicação |
|---|---|---|
| `P1` | Crítico (Segurança / Quebra de Tipos / Crash) | Crash em runtime no Android/iOS, vazamento de credenciais em SecureStore. |
| `P2` | Arquitetura / Funcionalidade Bloqueada | Falha de sincronização SSE, indisponibilidade do Hub do Servidor, bug em `api.ts`. |
| `P3` | Performance / UX | Lentidão na listagem de arquivos, animações engasgadas, ajuste de layout. |
| `P4` | Documentação / Higiene | Ajuste em `AGENTS.md`, atualização de comentários, refatoração menor sem impacto funcional. |

## Labels de Categoria

- `bug`: Correção de defeito funcional ou regressão.
- `feature`: Nova funcionalidade ou melhoria de produto.
- `documentation`: Alterações em documentação ou governança.
- `refactor`: Alteração de código sem mudança de comportamento externo.
- `expo`: Específico para dependências nativas, EAS ou SDK Expo.
