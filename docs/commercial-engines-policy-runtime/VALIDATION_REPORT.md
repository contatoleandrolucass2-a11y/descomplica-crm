# Relatório de validação local

Data: 10 de agosto de 2026. Branch:
`codex/commercial-engines-policy-runtime`. Base exata:
`1f570d0a7b3ce64571019b121b0b4aff132e1676`.

## Estado comprovado

- 14 chaves estruturais; zero policy/caso de ouro oficial importado;
- zero gate e zero grant de execução por papel;
- `COMMERCIAL_ENGINE_RUNTIME_MODE=off`, allowlist e URL dedicadas vazias em
  todos os exemplos/configurador;
- `crm_commercial_engine` com `NOLOGIN`, sem senha criada pela migration, sem
  ACL de tabela/sequence e sem membership utilizável;
- nenhum formulário visual conectado ao endpoint;
- nenhum consumidor server-side para os nove motores não interativos;
- nenhum ambiente remoto alterado.

## Gates executados

| Gate                                  | Resultado                                                      |
| ------------------------------------- | -------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`      | verde; lockfile inalterado                                     |
| `pnpm lint`                           | verde                                                          |
| `pnpm typecheck`                      | verde                                                          |
| `pnpm test`                           | 226 Vitest aprovados, 1 ignorado; 8 Node aprovados             |
| `pnpm build`                          | verde; 37 páginas geradas, incluindo o Route Handler dinâmico  |
| reset integral Supabase local         | 22 migrations aplicadas sem erro                               |
| `pnpm db:test`                        | 863/863 pgTAP; suíte comercial 93/93                           |
| `supabase db diff --local`            | zero schema drift em `public`, `private` e `commercial_engine` |
| advisors locais security/performance  | zero issue                                                     |
| `pnpm audit --audit-level high`       | zero vulnerabilidade conhecida                                 |
| Gitleaks árvore + 210 commits         | zero vazamento                                                 |
| OSV-Scanner                           | zero issue em 519 pacotes                                      |
| Actionlint, ShellCheck, `bash -n`     | verdes                                                         |
| Docker Compose com valores sintéticos | configuração válida                                            |

O lint SQL encontrou somente ruído da extensão pgTAP e dois warnings já
existentes em `public.ingest_crm_read_model_v3`; não apontou achado novo nas
funções deste incremento.

## Cobertura específica

- flags/allowlist/URL inválidas ou de outro project ref falham fechadas;
- Data API não executa lookup/ledger e não lê as cinco tabelas privadas;
- papel dedicado recebe somente dois entrypoints e seu checker detecta owner,
  `SECURITY DEFINER`, config, ACL, membership e capabilities indevidas;
- ator inativo/sem permissão, owner/backup inativo, gate/mode divergente e
  rollback concorrente bloqueiam a gravação/output;
- import é idempotente, vinculado ao plan hash e monotônico por engine; replay
  histórico exato permanece idempotente após owner inativo;
- policy/import/execution são imutáveis e o ledger persiste somente hashes;
- decimal com sinal, seis arredondamentos, 18 casas, output de até 30 dígitos,
  intermediários, divisão por zero, datas, AST, concat, JSON canônico e payload
  streaming limitado;
- runtime exige atestação privada do verifier e documento congelado;
- hashes fixos da mesma fixture estrutural em TypeScript e pgTAP detectam drift;
- manifesto local é novo, `0600`, atômico e sem rede/banco;
- origem forjada por `X-Forwarded-Host` é rejeitada.

## QA visual

Não aplicável a este incremento: nenhuma página, formulário, tema, estilo ou
componente visual foi alterado, e o endpoint permanece inacessível por default.
As jornadas existentes continuam mostrando motor indisponível e sem submit.

## Bloqueios para qualquer ativação futura

1. políticas e casos de ouro oficiais por domínio;
2. owner/backup e fontes de input aprovados;
3. migration remota autorizada e provisionamento privado do papel dedicado;
4. hardening das capabilities herdadas até o checker retornar `true`;
5. grants de execução mínimos por coorte, com pgTAP próprio;
6. integração server/database escopada de cada consumidor;
7. shadow, canário, thresholds, janela, rollback e E2E aprovados.

As pendências operacionais do relay Qlik, seus workflows e o hardening
destrutivo do PR #28 não foram tocados.
