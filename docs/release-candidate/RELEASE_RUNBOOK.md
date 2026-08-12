# Merge train, canário, rollback e deploy

## Proibições atuais

Este runbook é ensaio/documentação. Não executar seus passos remotos sem nova
autorização explícita. Flags ficam off. Hardening destrutivo do PR #28 continua
fora do cutover inicial.

## Gate 0 — congelar release candidate

1. Registrar SHA completo deste incremento e árvore limpa.
2. Confirmar heads de #26–#31 contra
   [auditoria](STACK_AUDIT.md#escopo-congelado).
3. Executar todos os comandos do bloco de validação local.
4. Confirmar CI no mesmo SHA, sem rerun em commit diferente.
5. Fechar todas as decisões do [pacote de aprovações](APPROVAL_PACKAGE.md).

## Merge train empilhado

Ordem obrigatória:

`#26 → #27 → #28 → #29 → #30 → #31 → release candidate`

As branches são empilhadas. Estratégia segura:

1. preservar ancestry por merge commits; ou, se squash for obrigatório,
   restack/rebase explícito de todos os PRs seguintes;
2. retargetar somente o próximo PR para `main` depois do anterior entrar;
3. rerodar CI no novo head de cada PR;
4. comparar a árvore final: `git diff --exit-code <RC_SHA> main`;
5. bloquear se o diff contiver mudança não auditada.

Não fazer merge nesta branch por este runbook.

## Ordem do banco — bloqueio P0

As migrations `20260807185611`, `20260808174817` e `20260809024000` são
anteriores ao último registro remoto `20260809031936`. Antes de qualquer push,
aprovar e ensaiar uma única estratégia:

- recomendada: reversionar/consolidar os efeitos ainda não remotos em migration
  forward, mantendo os arquivos históricos para rebuild local; ou
- excepcional: autorizar `--include-all` somente após restore exato do backup
  remoto e revisão statement a statement.

Nunca usar `migration repair` para fingir convergência. Nunca usar `db push`
até a estratégia gerar a mesma árvore validada no restore.

## Sequência app-first e rollback floor

1. Capturar backup remoto, checksum e restore isolado exato.
2. Publicar imagem compatível ainda com todas as flags off.
3. Confirmar `/api/health` com o `DEPLOYMENT_VERSION` esperado e ausência de
   dados comerciais anônimos.
4. Aplicar somente migrations aditivas aprovadas pela estratégia do Gate P0.
5. Após novas permission keys no banco, o rollback floor da aplicação é a
   imagem desta RC (ou outra comprovadamente equivalente e posterior a
   `d00118f`). Não voltar para imagem pré-pilha.
6. Rollback funcional preferido: mesma imagem compatível + flags off + gates DB
   revogados. Migrations destrutivas não participam desta fase.

## Shadow e canário

### Relay/read model

1. Provisionar credenciais privadas e validar TLS/menor privilégio.
2. Importar mappings somente após preview, conflitos resolvidos e hash do plano
   aprovado.
3. Executar duas janelas shadow aprovadas, sem escrita/cutover.
4. Comparar contagens, freshness, rejeições, replay, rate limit, coverage e
   isolamento por escopo.
5. Promover uma coorte canário aprovada; `QLIK_RELAY_WRITE_ENABLED` só muda com
   gate DB correspondente.
6. Em qualquer limiar violado: `mode=off`, write=false, credential desabilitada
   e gate revogado.

### Motores

1. Importar política oficial e casos de ouro; validar hash/versão/vigência.
2. Executar shadow somente para engine/coorte permitida.
3. Conferir ledger, replay, arredondamento, limites e ausência de output shadow.
4. Active exige autorização separada, grant temporal e canário aprovado.
5. Revogar gate/grant ou voltar à versão oficial anterior no primeiro limiar
   violado.

## Hardening e deploy final

Somente depois de cutover estável e leitores residuais zerados:

1. autorizar separadamente a revogação da RPC/ACL legada;
2. executar pgTAP, RLS, smoke por perfil e ausência anônima;
3. registrar digest imutável da imagem, SHA, migrations e flags;
4. monitorar janela aprovada;
5. encerrar somente com owner e backup aceitando a operação.

## Validação local reproduzível

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec supabase db reset --local --no-seed
pnpm db:test
pnpm exec supabase db lint --local --level warning --fail-on warning
pnpm exec supabase db advisors --local --type security --level warn --fail-on warn
pnpm exec supabase db advisors --local --type performance --level warn --fail-on warn
pnpm qa:security:rls-api
pnpm qa:e2e:release
pnpm qa:visual:authenticated
pnpm db:rehearse
pnpm audit --audit-level high
pnpm security:secrets
pnpm security:secrets:history
pnpm security:osv
git diff --check
actionlint .github/workflows/ci.yml
```
