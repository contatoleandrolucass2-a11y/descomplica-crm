# Canário, cutover e rollback — procedimento preparado

Este runbook é somente preparação. Não autoriza migration remota, importação,
grant, alteração de flag, canário, cutover ou deploy.

## Pré-condições bloqueantes

- migration aprovada e aplicada em janela separada;
- pacote oficial completo para uma única chave;
- owner e backup ativos, com aceite operacional;
- casos de ouro assinados e reproduzidos localmente;
- fonte/inputs reais disponíveis com RLS e escopo já validados;
- PR/CI/E2E do consumidor específico verdes;
- papel `crm_commercial_engine` provisionado privadamente com credencial própria,
  `session_user` comprovado e `private.crm_commercial_engine_role_isolated()`
  retornando `true`; a migration deste incremento deixa o papel `NOLOGIN`;
- janela, aprovador, observador e critério de rollback registrados;
- `crm.simulators.execute` concedida somente aos perfis do canário por migration
  e pgTAP próprios;
- nenhum segredo ou token em shell history, PR ou artefato.
- `COMMERCIAL_ENGINE_DATABASE_URL` usando somente o papel dedicado (ou sufixo
  de pooler), o mesmo project ref de `NEXT_PUBLIC_SUPABASE_URL`,
  `sslmode=verify-full` e senha distinta de HMAC/secret keys.

## Preparação e dry-run

1. Salvar o documento oficial fora do Git, modo `0600`.
2. Gerar manifesto verificado:

   ```bash
   pnpm commercial-policy:verify \
     --policy /caminho/privado/policy.json \
     --manifest-out /caminho/privado/manifest.json
   ```

3. Registrar os hashes e a quantidade de casos no ticket oficial, sem copiar
   conteúdo comercial para logs.
4. Executar `preview_crm_commercial_policy_import` com sessão QA Master dedicada.
5. Revisar `ready`, disposition e `planHash`; conflito interrompe o fluxo.
6. Somente após aprovação explícita, executar apply com o manifesto exato e o
   `planHash`. Apply importa a versão; não ativa o motor.

## Shadow

1. Criar gate `shadow` para a policy exata, com razão/evidência.
2. Em uma revisão de configuração separada, alterar o runtime para `shadow` e
   allowlist de uma única chave, com a URL dedicada injetada por canal privado.
3. Executar apenas casos QA autorizados. A resposta deve ser 202 sem output.
4. Monitorar:
   - contagem por engine/mode/outcome;
   - latência p50/p95/p99;
   - `policy_unavailable`, `policy_invalid`, `audit_unavailable` e conflitos;
   - replay e fingerprint da versão;
   - ausência de payload/output nos logs.
5. Reconciliar hashes/outputs em artefato privado com os casos oficiais.

Critério sugerido, ainda sujeito a aprovação oficial: zero divergência de caso
de ouro e zero quebra de autorização. Este documento não inventa volume,
duração ou tolerância numérica.

## Canário ativo

1. Fixar janela e coorte QA; não usar conta pessoal Admin/Master para automação.
2. Conceder a permissão de execução somente à coorte por alteração versionada.
3. Promover gate e flag para `active` na mesma chave, em mudanças separadas e
   reversíveis.
4. Confirmar que output só aparece após gravação do ledger.
5. Comparar todo resultado com a autoridade oficial e confirmar isolamento por
   perfil/organização quando o motor usar dados de negócio.

O catálogo suporta o estado operacional; duração, volume e thresholds não foram
preenchidos porque não existe decisão oficial.

## Rollback

Ordem fail-closed, sem apagar histórico:

1. `COMMERCIAL_ENGINE_RUNTIME_MODE=off` e allowlist vazia;
2. remover `COMMERCIAL_ENGINE_DATABASE_URL` do ambiente;
3. gate para `rolled_back`/`disabled`, apontamento removido conforme contrato;
4. revogar grants temporários de `crm.simulators.execute` por migration;
5. preservar policy, import command e ledger imutáveis;
6. validar 503 no endpoint, ausência de output e páginas visuais indisponíveis;
7. abrir incidente com fingerprint, janela e razão — nunca payload comercial.

Não usar update/delete de policy como rollback. Nova fórmula requer nova versão.

## Alertas sem thresholds inventados

O evento `crm.commercial_engine` expõe apenas engine, modo, outcome, HTTP,
duração arredondada, request ID, replay e 12 caracteres do hash da policy.
Dashboards/alertas podem agrupar esses campos. Thresholds e destinatários ficam
pendentes até SRE/owner aprovarem; enquanto isso, qualquer `policy_invalid` ou
`audit_unavailable` no canário é condição de parada manual.
