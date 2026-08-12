# Runtime versionado de políticas comerciais

## Resultado deste incremento

Esta fundação recebe políticas oficiais futuras sem transformar legado,
capturas visuais ou fixtures em autoridade. Todo motor permanece indisponível.
Não houve importação de policy, seed comercial, alteração remota, cutover ou
integração com os leitores atuais.

| Domínio     | Chaves estruturais                                | Policy oficial | Gate   |
| ----------- | ------------------------------------------------- | -------------- | ------ |
| Simuladores | `simulator.wf13`, `wf14`, `wf15`, `wf16`, `caixa` | nenhuma        | nenhum |
| Metas       | `goals.dv`, `goals.partnerships`                  | nenhuma        | nenhum |
| Pontos      | `points.ranking`                                  | nenhuma        | nenhum |
| Ranking     | `ranking.broker`, `ranking.manager`               | nenhuma        | nenhum |
| SLA         | `sla.loss`                                        | nenhuma        | nenhum |
| Roleta      | `roulette.eligibility`                            | nenhuma        | nenhum |
| Campanhas   | `campaign.eligibility`                            | nenhuma        | nenhum |
| Premiações  | `awards.calculation`                              | nenhuma        | nenhum |

“Estrutural” significa apenas chave, domínio e boundary de autorização. Não
existe fórmula, peso, percentual, limite, meta, prêmio ou valor embutido.

## Cinco gates independentes

Uma execução só alcança output quando todos os controles concordam:

1. `COMMERCIAL_ENGINE_RUNTIME_MODE=active`, chave presente na allowlist e URL
   PostgreSQL dedicada válida;
2. conexão server-only autenticada como `crm_commercial_engine`, com isolamento
   de ACL comprovado pelo banco;
3. usuário ativo com permissão específica; para simuladores,
   `crm.simulators.execute`;
4. gate privado `active` apontando para uma versão vigente e aprovada;
5. integridade local: documento, hash e todos os casos de ouro revalidados pelo
   runtime.

Ausência, erro ou divergência em qualquer camada retorna indisponibilidade. O
modo `shadow` avalia e grava somente hashes; nunca devolve o resultado. A flag
não abre o banco, e o gate do banco não contorna a flag.

Neste incremento as flags são `off`, a allowlist e a URL dedicada são vazias,
o papel PostgreSQL nasce `NOLOGIN` e sem senha, não há grants de execução por
papel e não há gates. O baseline Supabase ainda faz o verificador de isolamento
retornar `false` por capabilities herdadas de `PUBLIC`. Provisionar o login e
remediar essas ACLs exige incremento remoto próprio e autorização explícita; o
configurador de produção força `off` e não oferece ativação.

## Componentes

- `lib/crm/commercial-engine/contract.ts`: contrato fechado de policy,
  manifestação de importação e request.
- `decimal.ts`: decimal exato baseado em `BigInt`, sem ponto flutuante.
- `runtime.ts`: compilação, typecheck, limites de complexidade, datas UTC e
  execução determinística.
- `catalog.ts`: 14 chaves estruturais e boundary browser/server.
- `handler.ts`: POST autenticado, same-origin, payload limitado e resposta
  sanitizada para os cinco simuladores.
- `config.ts` e `data.ts`: configuração fail-closed e conexão PostgreSQL direta
  pelo papel dedicado; não usam Data API, SSR client ou `service_role`.
- migration `20260810201703`: catálogo privado, versões imutáveis, preview,
  imports, gates e ledger hashes-only com `FORCE RLS`.
- `ops/commercial-policies/verify.ts`: verificação local e geração opcional de
  manifesto `0600`, sem banco ou rede.

Detalhes: [contrato](POLICY_CONTRACT.md),
[operação/cutover](OPERATIONS.md), [validação local](VALIDATION_REPORT.md) e
[decisões pendentes](REMAINING_DECISIONS.md).

## Limites conscientes

- O runtime v1 opera escalares `decimal`, `boolean`, `string` e `date`. Políticas
  oficiais que exijam listas, tabelas tarifárias ou agregações devem evoluir o
  contrato de forma versionada; não serão achatadas em constantes.
- Somente simuladores têm boundary HTTP. Metas, pontos, ranking, SLA, roleta,
  campanhas e prêmios aguardam integração server-side própria e testes de
  isolamento no incremento que os ativar.
- As configurações v2 de metas/pontos e a apresentação atual do ranking não são
  automaticamente policies. Nenhum histórico foi reclassificado.
- Casos de teste sintéticos comprovam o software, não a política comercial.
- Decimais de cálculo são strings numéricas canônicas; formatação monetária é
  responsabilidade da apresentação e não altera o valor/hash do motor.

## Invariantes de segurança

- Nenhum grant direto às tabelas privadas.
- `PUBLIC`, `anon`, `authenticated`, `service_role` e `crm_qlik_relay` sem ACL
  dos dois entrypoints de runtime. Somente `crm_commercial_engine` recebe
  `EXECUTE`; pessoas usam apenas as RPCs autenticadas de gestão.
- Policy publicada é imutável; correção cria versão nova.
- Owner e backup são distintos e precisam existir ativos no registry já
  versionado. O importador nunca cria ou presume owners.
- Replays idênticos são idempotentes; request ID reutilizado com conteúdo
  diferente falha.
- Ledger não persiste input/output; telemetria não registra fórmula, payload,
  segredo ou resultado.
- A gravação final revalida e bloqueia ator, permissão, gate, owner e backup;
  rollback/deativação concorrente falha como indisponibilidade, nunca output.
- Nenhuma flag, policy ou gate concede acesso aos fatos protegidos dos read
  models. Consultas dimensionais continuam exigindo enforcement próprio.
