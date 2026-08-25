# Compatibilidade remota do PR #49

## Escopo e método

Esta evidência foi capturada em 25 de agosto de 2026 contra o projeto produtivo
vinculado, sempre dentro de transações `READ ONLY`. Nenhuma migration, grant,
policy, linha, configuração ou usuário remoto foi alterado. Identificadores de
usuário, e-mails, payloads comerciais, tokens, verificadores e corpos SQL
confidenciais não integram este documento.

Fontes usadas:

- catálogos PostgreSQL e `supabase_migrations.schema_migrations`, consultados
  somente em leitura;
- backups produtivos root-only verificados, incluindo o snapshot corrente de
  25 de agosto de 2026 usado no rehearsal;
- histórico Git completo, refs, reflogs, objetos alcançáveis, worktrees e
  documentação técnica local;
- head-base do PR #49 em `0445dbabc1fef4ac7a5bf22219616f7e65760241` e
  refatoração RBAC candidata em `df3c5343f91bd7804d6067e452da3d6feb8dfc9c`.

O inventário estrutural sanitizado está em
[`production-schema-inventory.json`](production-schema-inventory.json). O
manifesto de versões e hashes está em
[`production-migration-manifest.json`](production-migration-manifest.json).

## Baseline produtiva observada

- PostgreSQL `17.6`; transação auditora com `transaction_read_only=on`.
- 22 tabelas de aplicação: 21 em `public` e uma em `private`.
- 28 funções de aplicação, 17 policies, oito triggers e 26 migrations remotas.
- Última migration remota: `20260814045436`.
- `profiles` possui seis colunas e **não** possui `access_status`.
- Não existem as funções `private.is_approved_user(uuid)`,
  `private.user_role_scope_is_valid(uuid,text)` ou
  `private.can_manage_user(uuid)`.
- Não existem as funções/papéis de isolamento de relay e motor comercial.
- Não existem as tabelas futuras de organizações, pessoas, equipes, carteiras
  ou reporting scopes.

As dependências Auth usadas pela candidata também foram confirmadas diretamente
no schema remoto, sem consultar linhas: `auth.sessions.id/user_id` são UUID
obrigatórios, `not_after` é `timestamptz` anulável e `aal` é
`auth.aal_level` anulável; `auth.mfa_factors.user_id` e `status` são obrigatórios,
com `status` em `auth.factor_status`. Os enums possuem os labels `aal1`, `aal2`,
`aal3`, `unverified` e `verified`. `auth.uid()` retorna UUID e `auth.jwt()`
retorna JSONB; ambas são SQL `STABLE`, pertencentes a `supabase_auth_admin`.
O inventário registra somente esses metadados e o hash do dump root-only, nunca
sessões, fatores, secrets ou corpos de função.

Essas ausências comprovam por que as duas migrations originais do PR #49 não
podiam ser aplicadas isoladamente: a primeira referenciava a fundação futura de
escopos; a segunda tentava substituir funções e alterar papéis que não existem
na produção.

## Grants, RLS e funções sensíveis

- As três tabelas Qlik têm RLS habilitada e forçada, nenhuma policy de leitura
  e nenhum grant direto para `anon`, `authenticated` ou `service_role`.
- A tabela privada de verificadores legados não possui grant para Data API. Seu
  conteúdo nunca foi copiado para Git.
- Quatorze tabelas `public` possuem `SELECT` para `authenticated`, todas
  protegidas por policy.
- `service_role` possui somente o `EXECUTE` de ingestão Salesforce já
  versionado; não possui acesso direto às tabelas Qlik.
- Duas RPCs Qlik legadas ainda possuem `EXECUTE` por `anon`. Esta auditoria não
  as altera: publisher/reader permanecem assunto de cutover separado.
- `bootstrap_master_user(uuid)` continua sem `EXECUTE` para Data API.

## Matriz de acesso que deve permanecer invariável

Produção possui oito papéis persistidos, 20 permissões, 61 associações de papel
e zero override direto. A migration Auth/MFA não pode inserir, remover ou
atualizar nenhuma associação existente.

| Papel         | Permissões atuais |
| ------------- | ----------------: |
| `master`      |                20 |
| `admin`       |                17 |
| `broker`      |                 4 |
| `broker_lead` |                 4 |
| `coordinator` |                 4 |
| `real_estate` |                 4 |
| `supervisor`  |                 4 |
| `user`        |                 4 |

As 14 páginas ativas de `admin` são:

1. `/admin`
2. `/app`
3. `/app/configuracoes`
4. `/admin/usuarios`
5. `/app/configuracoes/metas`
6. `/app/etapas/oportunidades`
7. `/admin/paginas`
8. `/app/configuracoes/metas/parcerias`
9. `/app/etapas/agendamentos`
10. `/app/configuracoes/metas/pontos`
11. `/app/etapas/visitas`
12. `/app/etapas/pastas`
13. `/app/etapas/vendas`
14. `/app/ranking`

O rehearsal compara o fingerprint ordenado de `roles`, `permissions`,
`role_permissions` e `app_pages` antes e depois das migrations candidatas. Uma
diferença encerra o gate.

## Reconciliação das sete versões remotas

As sete versões existem no histórico remoto e não possuíam arquivo com o mesmo
timestamp no Git. Os statements exatos foram encontrados no backup root-only
verificado e confirmados por tamanho e SHA-256 no histórico remoto atual.

| Versão           | Classificação               | Reconciliação segura                                                                     |
| ---------------- | --------------------------- | ---------------------------------------------------------------------------------------- |
| `20260813133534` | hardening seguro            | Statement idêntico ao arquivo local `20260813115335`; marker no-op.                      |
| `20260813142723` | leitura pública insegura    | Não reproduzir; supersedida por `20260813151446`; marker no-op.                          |
| `20260813142835` | policies públicas inseguras | Não reproduzir; supersedida por `20260813151446`; marker no-op.                          |
| `20260813160418` | convergência RBAC segura    | Mesmo SQL de `20260813140000`, exceto comentário e newline; marker no-op.                |
| `20260813161959` | reader legado confidencial  | SQL preservado somente no backup root-only; nenhum verificador em Git; marker no-op.     |
| `20260813172800` | revisão do reader legado    | SQL preservado somente no backup root-only; nenhum contrato legado em Git; marker no-op. |
| `20260813192928` | gate Master seguro          | Mesmo SQL de `20260813143000`, exceto newline final; marker no-op.                       |

O histórico Git não contém os quatro statements exclusivos remotos. Não existe
commit candidato que possa ser promovido como autoridade. Os três statements
seguros restantes têm contrapartes canônicas comprovadas por hash ou comparação
byte a byte sem o comentário/newline indicado. Os markers adicionados não
executam DDL e não tentam recriar o estado remoto inseguro ou confidencial.

Após os markers, `supabase migration list --linked` alinha as sete versões nos
dois lados. A mesma consulta ainda mostra 13 predecessoras somente locais e as
duas candidatas Auth/MFA somente locais. Isso é esperado e **não** autoriza
aplicar a fila: o rehearsal seleciona as candidatas pelos nomes completos e
rejeita qualquer migration adicional.

Backup corrente de proveniência usado, gerado somente em leitura e mantido fora
do Git:

`/var/backups/descomplica-crm/pr49-remote-rehearsal/20260825T203000Z`

Arquivos relevantes, todos `root:root 0600`:

| Arquivo              | SHA-256                                                            |
| -------------------- | ------------------------------------------------------------------ |
| `schema.sql`         | `5ae74a0fc526e6865ba03c1d6e0de023921561589739e8db401ae9b5ea7e3196` |
| `data.sql`           | `766d0532930f25abaa01bc0a377e5b4334d151f6e7ab51f1d2e180e794ba2ccc` |
| `history-schema.sql` | `ae56295c7e66a8b46ab50df6f00cf57f7866f2478a17fbe3910d9def39e836ab` |
| `history-data.sql`   | `9f191ea51894762bd07e139e8b78b097beefe31c8797dc1dda28f8ffbf963bf7` |
| `roles.sql`          | `168a95a9c745af5ed4679751f90419ac9dc434240a213b03e32a06d5664c2308` |

## Rehearsal sobre estado remoto sanitizado

[`scripts/db/rehearsal/remote-state.mjs`](../../scripts/db/rehearsal/remote-state.mjs)
aceita somente um diretório absoluto root-only com manifesto válido. O processo:

1. inicia dois projetos Supabase/PostgreSQL 17 locais, efêmeros e distintos;
2. restaura schema, histórico e dados produtivos somente no projeto-fonte,
   isolado da rede;
3. extrai do fonte apenas tabelas estruturais sem PII ou valores comerciais;
4. restaura no alvo o schema remoto e essa baseline sanitizada;
5. aplica somente as migrations candidatas explicitamente permitidas;
6. exige histórico reconciliado, fingerprint RBAC idêntico, ausência de grants
   Qlik diretos, ausência de policies permissivas de leitura e exatamente uma
   policy MFA restritiva em cada tabela Qlik, além dos objetos Auth/MFA;
7. remove os dois projetos e todos os temporários mesmo após falha.

Antes do restore, o rehearsal neutraliza somente as ACLs padrão permissivas da
imagem local. Os grants explícitos do dump recompõem então o estado observado
em produção. Isso evita que diferenças de bootstrap local falseiem a prova sem
alterar o backup ou mascarar uma ACL candidata.

O script nunca imprime SQL, URLs de banco, tokens, verificadores ou linhas
restauradas. Evidência contém apenas hashes, contagens e booleanos.

## Consequência para deploy

Não usar `db push --include-all`, `migration repair` ou aplicação em lote. Com
os markers versionados, o próximo gate deve usar uma allowlist explícita das
duas migrations Auth/MFA, sobre backup novo e restore sanitizado aprovado. As
migrations não podem tocar a matriz atual nem os contratos Qlik, Salesforce,
relay ou motores comerciais.
