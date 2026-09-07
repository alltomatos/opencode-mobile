# Rastreabilidade de Issues — GitHub

> Fonte Única da Verdade para Tarefas, Bugs, Mudanças de Arquitetura e Histórico.

## Repositório Remoto
- **GitHub**: `alltomatos/opencode-mobile`
- **URL**: `https://github.com/alltomatos/opencode-mobile`

## Diretrizes de Rastreabilidade

1. **GitHub Issues**: Todas as tarefas executadas pelo orchestrator ou subagentes devem estar vinculadas a uma Issue no GitHub.
2. **Ciclo de Vida das Issues**:
   - **Criação**: Pela skill `/to-issues` a partir dos gaps auditados ou do roadmap.
   - **Triage**: Etiquetadas com as labels padrão definidas em `triage-labels.md`.
   - **Execução**: Agentes trabalham em branches de funcionalidade vinculadas à Issue (`feat/issue-#ID-descricao` ou `fix/issue-#ID-descricao`).
   - **Fechamento**: Após a aprovação final pela skill `/qa-analyst` e merge do Pull Request.
3. **Mapeamento Local**: O arquivo `ESTADO_ORQUESTRATOR.md` mantém a visão operacional da DAG, mas a sincronização de status, comentários e critérios de aceite ocorre no GitHub.
