# Gate de reconciliação de fontes e migrations

## Escopo

Este diretório registra o gate iniciado a partir do commit
`81968eb72371d5a1a794d48703de41a7feb58f70`, sem alterar o PR #26, o banco
remoto, workflows, DNS, Nginx ou a aplicação em produção.

O domínio canônico confirmado para o plano futuro é
`https://descomplicapro.com.br/`. O domínio
`https://crm.descomplicapro.com.br/` permanece apenas como candidato a alias ou
redirecionamento até a validação operacional documentada.

## Entregas

- [Matriz de migrations](MIGRATION_MATRIX.md): inventário local/remoto, hashes,
  dependências, classificação e plano de convergência.
- [Inventário remoto sanitizado](REMOTE_SCHEMA_SANITIZED.md): estado de schema,
  RLS, ACLs e funções observado por consultas somente leitura; o dump DDL exato
  continua bloqueado pela sessão ausente da CLI.
- [Contratos de integração](INTEGRATION_CONTRACTS.md): Salesforce, n8n, Qlik e
  estoque, com fontes, tipos, identidades, recortes e lacunas.
- [Políticas comerciais](COMMERCIAL_POLICY_INVENTORY.md): origem e grau de
  confiança das regras encontradas, mais a matriz única de decisões pendentes.
- [Proposta de RLS e escopos](RLS_SCOPE_PROPOSAL.md): modelo deny-by-default,
  ordem futura de migrations e testes positivos/negativos.
- [Backup, restore e domínio](OPERATIONS_GATE_PLAN.md): procedimento
  reproduzível, bloqueios, rollback e próximo gate.
- Contratos Zod/TypeScript em
  [`lib/crm/integrations/contracts.ts`](../../lib/crm/integrations/contracts.ts)
  e testes locais em
  [`tests/integration-contracts.test.ts`](../../tests/integration-contracts.test.ts).

## Resultado do gate

O SQL histórico das quatro migrations somente remotas foi recuperado da coluna
`supabase_migrations.schema_migrations.statements`. O conteúdo exato não foi
copiado para o Git porque duas versões contêm um verificador de credencial e as
quatro reproduzem grants ou contratos incompatíveis com a política atual. Os
hashes e os objetos afetados permanecem registrados para prova de identidade.

Foram confirmados dois riscos P0 no estado remoto:

1. as três tabelas Qlik aceitam `SELECT` de `anon` e escrita direta de
   `service_role`; a RPC legada de publicação aceita `anon` e executa como
   `SECURITY DEFINER`;
2. o cadastro público cria perfil ativo com papel `user`, enquanto esse papel e
   as policies atuais dão acesso aos snapshots comerciais globais, sem escopo de
   organização, equipe ou carteira.

Nenhum desses riscos foi alterado remotamente neste gate. A convergência exige
backup restaurado em ambiente isolado, decisão de escopos e migrations novas
testadas localmente. Até isso ocorrer, merge, migration remota e deploy
continuam bloqueados.

## Fontes consultadas

- histórico Git completo, tags de checkpoint, branches, reflog e objetos
  alcançáveis/não alcançáveis;
- PRs e workflows do GitHub existentes até o PR #26;
- migrations, pgTAP, código, fixtures, runbooks e documentação versionados;
- catálogos PostgreSQL e histórico de migrations do Supabase, somente leitura;
- metadados sanitizados das últimas bases Salesforce e Qlik;
- configuração local da CLI e processo de deploy, sem leitura ou impressão de
  segredos.

Nenhum backup SQL histórico, artefato de Actions ou segunda cópia do SQL remoto
foi encontrado no repositório ou nos refs acessíveis.
