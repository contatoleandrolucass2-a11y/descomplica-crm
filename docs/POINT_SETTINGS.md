# Configuração de pontos

## Contrato migrado

A rota `/app/configuracoes/metas/pontos` preserva as sete métricas do CRM original: roleta em dias úteis, sábado e domingo, agendamento, visita, pasta aprovada e venda. Cada métrica possui peso e objetivo inteiro entre 0 e 100.000.

Quando ainda não existe configuração, a interface apresenta os pesos sugeridos do contrato original, mas informa que eles somente passam a valer após o primeiro salvamento. A migration não cria dados comerciais nem configuração implícita.

## Persistência

- `crm_point_settings`: metadados do conjunto `default` e ator da última alteração;
- `crm_point_metrics`: uma linha tipada por atividade, com peso e objetivo;
- `replace_crm_point_settings`: valida e substitui as sete linhas em uma transação.

Os antigos `weights_json` e `targets_json` do D1 não foram copiados para a persistência final. O JSON recebido pela RPC é apenas o envelope de transporte; chaves desconhecidas, ausentes, fracionárias, negativas ou acima do limite são rejeitadas antes da escrita.

## Autorização e auditoria

Usuários com `crm.ranking.view` podem ler os pesos que alimentarão o ranking. Somente `crm.settings.manage` pode chamar a RPC de substituição. `authenticated` não possui `INSERT`, `UPDATE` ou `DELETE` direto; `anon` não possui leitura. Cada troca gera `crm.point_settings.replaced` em `audit_logs`.

## Testes

`point_settings.test.sql` cobre grants, RLS, ausência de seed, catálogo completo, substituição idempotente, auditoria, leitura do ranking, deny override e bloqueio de conta inativa. A QA autenticada confirmou o formulário, persistência e ausência de overflow horizontal; os dados temporários foram removidos por reset.
