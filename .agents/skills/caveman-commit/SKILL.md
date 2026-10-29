---
name: caveman-commit
description: Redigir mensagem curta de commit em português, com objetivo técnico e escopo verificável.
---

# Mensagens de commit do CRM

Use `tipo(escopo): resumo curto`, em português. Descreva o objetivo técnico;
mencione o workflow impactado quando houver impacto confirmado.

Inclua corpo somente quando necessário para explicar motivo, compatibilidade,
reversão, segurança ou migração. Preserve as informações indispensáveis dessas
mudanças. Não invente impacto, validação, fechamento de issue ou publicação.

A skill apenas orienta a mensagem. Stage, commit e push seguem a autorização
da tarefa; não são iniciados pela seleção da skill. Reutilize o contexto do
diff já conferido, sem nova auditoria global para redigir uma mensagem.

Origem preservada em `references/upstream-skill.txt`, somente para proveniência,
sem leitura automática. O contrato local acima prevalece no CRM.
