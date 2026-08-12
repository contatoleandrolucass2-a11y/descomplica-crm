# Pacote único de aprovações

Este documento é o índice obrigatório. Mensagens informais, nomes inferidos ou
valores copiados do sistema antigo não substituem aprovação registrada.

## Registro mínimo por decisão

Cada item aprovado deve conter:

- `decision_id` estável;
- decisão exata e ambiente;
- owner e substituto/backup;
- autoridade que aprovou;
- evidência HTTPS ou referência privada verificável;
- data/hora, validade e data de revisão;
- impacto, coorte e dados abrangidos;
- rollback owner e critério objetivo;
- assinatura/aceite dos responsáveis de negócio, dados, segurança e operação
  aplicáveis.

Não registrar segredo, senha, HMAC, token ou URL com credencial neste arquivo.

## Perguntas bloqueadoras objetivas

Todas as linhas abaixo permanecem **pendentes**. Escolher uma opção exige o
registro mínimo acima; texto legado, fixture ou inferência técnica não vale como
aprovação.

| `decision_id`         | Pergunta objetiva                                                | Opções admissíveis                                                                           | Impacto enquanto pendente                                           | Responsável necessário              |
| --------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------- |
| `OPS-QLIK-OWNER`      | Quem responde operacionalmente pelo workflow `r4DyPyOTDtoROXq0`? | Nomear owner com aceite; transferir para equipe aprovada; manter bloqueado                   | Relay/cutover Qlik não pode avançar                                 | Operação Qlik/n8n + Segurança       |
| `OPS-QLIK-BACKUP`     | Quem substitui o owner e já testou o procedimento?               | Nomear backup; designar equipe de plantão; manter bloqueado                                  | Não existe continuidade nem rollback seguro                         | Operação Qlik/n8n                   |
| `OPS-QLIK-READERS`    | Quem são os leitores `GET` residuais?                            | Migrar leitor identificado; comprovar descontinuação; manter ACL legada e bloquear hardening | Revogação pode interromper consumidor desconhecido                  | Segurança + owners de integrações   |
| `OPS-QLIK-HMAC`       | O provisionamento privado e a rotação HMAC estão aprovados?      | Provisionar chave exclusiva; usar cofre M2M aprovado; manter relay off                       | Caminho HTTP autenticado continua indisponível                      | Segurança + Operação                |
| `OPS-QLIK-DB`         | Qual credencial DB mínima será usada pelo relay?                 | Papel dedicado com TLS `verify-full`; pooler dedicado equivalente; manter bloqueado          | Teste HTTP→DB e canário não podem ocorrer                           | DBA/Supabase + Segurança            |
| `OPS-CANARY-WINDOW`   | Qual janela/coorte pode executar canário?                        | Janela proposta aprovada; escolher outra janela; manter bloqueado                            | Nenhuma promoção controlada pode começar                            | Operação + Dados + Negócio          |
| `OPS-CUTOVER-WINDOW`  | Qual janela, freeze e comando humano autorizam cutover?          | Aprovar janela; reagendar; manter bloqueado                                                  | Read model/relay permanecem sem cutover                             | Operação + Segurança + Negócio      |
| `OPS-ROLLBACK-WINDOW` | Quem decide/executa rollback e em quanto tempo?                  | Owner + backup com limite aprovado; plantão aprovado; manter bloqueado                       | Canário/cutover não possuem saída operacional segura                | Operação + Segurança                |
| `OPS-HOST`            | Qual host é canônico para App/Auth/CORS/cookies/DNS/TLS?         | Manter host atual; promover novo host em gate separado; manter divergência bloqueada         | Risco de login, cookie, CORS e redirect                             | Operação + Segurança + owner Auth   |
| `OPS-QA`              | Quais contas/coortes QA dedicadas podem testar cada perfil?      | Nove contas privadas por perfil; coortes equivalentes aprovadas; manter bloqueado            | E2E remoto autenticado não fecha                                    | QA + Segurança + owners de dados    |
| `OPS-BACKUP`          | Qual backup, custódia, retenção e restore isolado são oficiais?  | Backup lógico + restore; mecanismo gerenciado + restore; manter bloqueado                    | Migration remota e rollback de banco não são comprovados            | DBA/Supabase + Segurança            |
| `DATA-OWNERS`         | Quem é owner e backup de cada fonte/dataset?                     | Nomear por dataset; retirar dataset sem owner; manter indisponível                           | Fonte não pode se tornar autoridade                                 | Data steward + owner da fonte       |
| `DATA-MAPPINGS`       | Qual manifesto real associa IDs sem inferência?                  | Manifesto oficial versionado; autoridade de mapping aprovada; manter vazio                   | Fatos não podem ser associados a organização/equipe/carteira/pessoa | Data stewards dos dois lados        |
| `DATA-COHORT-GRANTS`  | Quais perfis recebem qual scope, validade e revogação?           | Migration aditiva por coorte; grant temporal individual; zero grants                         | V3 permanece 403/404 fora de fixtures                               | Segurança + Dados + owner do perfil |
| `DATA-V2-V3`          | Qual divergência e cobertura permitem sair de shadow?            | Critério quantitativo aprovado; revisão humana por janela; manter v2                         | Cutover do read model não pode ocorrer                              | Dados + Negócio + Operação          |
| `COMM-POLICY`         | Qual documento oficial rege cada engine?                         | Nova política assinada; integração com motor oficial; manter engine bloqueada                | Nenhum resultado comercial pode ser exibido como oficial            | Owner comercial + aprovador formal  |
| `COMM-GOLDEN`         | Quais entradas/saídas aprovadas provam cada versão?              | Casos normais/limites/erros assinados; suíte oficial equivalente; manter bloqueado           | Comportamento comercial não é validável                             | Owner comercial + QA de negócio     |
| `COMM-GRANT`          | Quem pode executar cada engine, em qual coorte/vigência?         | Grant temporal por engine; coorte fechada; zero grants                                       | Runtime permanece indisponível                                      | Segurança + owner comercial         |
| `COMM-ROLLBACK`       | Qual versão anterior e critério revogam cada engine?             | Versão oficial anterior; desligamento total; manter bloqueado                                | Active/canário comercial não pode começar                           | Owner comercial + Operação          |

A homologação visual isolada segue o
[`HOMOLOGATION_RUNBOOK.md`](HOMOLOGATION_RUNBOOK.md). Suas nove contas, grants e
fixtures são sintéticos e não respondem nenhuma pergunta operacional, de dados
ou comercial desta tabela.

## Aprovações operacionais

- [ ] `OPS-QLIK-OWNER`: owner operacional do workflow
      `r4DyPyOTDtoROXq0`.
- [ ] `OPS-QLIK-BACKUP`: substituto com acesso e procedimento testado.
- [ ] `OPS-QLIK-READERS`: todos os leitores GET residuais e plano por leitor.
- [ ] `OPS-QLIK-HMAC`: autorização para provisionamento privado, rotação e
      revogação; valor fica fora do Git.
- [ ] `OPS-QLIK-DB`: papel dedicado, TLS `verify-full`, grants mínimos e teste
      de conexão sem reutilizar `service_role`.
- [ ] `OPS-CANARY-WINDOW`: janela, duração, coorte, responsáveis, freeze e
      contato de incidente.
- [ ] `OPS-CUTOVER-WINDOW`: janela, freeze, aprovadores e comando humano de
      promoção.
- [ ] `OPS-ROLLBACK-WINDOW`: tempo máximo, decisão e executor do rollback.
- [ ] `OPS-HOST`: host canônico único para App/Auth/CORS/cookies/DNS/TLS.
- [ ] `OPS-QA`: ambiente e contas QA dedicadas por perfil/coorte.
- [ ] `OPS-BACKUP`: backup remoto novo, checksum, restore isolado e retenção.

## Aprovações de dados e escopo

- [ ] `DATA-OWNERS`: owners e backups para cada fonte/dataset.
- [ ] `DATA-MAPPINGS`: organizações, equipes, carteiras e pessoas com IDs,
      vigência, evidência e owner; zero associação presumida.
- [ ] `DATA-RECONCILIATION`: preview, conflitos, rejeições e hash do plano
      revisados antes de qualquer apply.
- [ ] `DATA-COVERAGE`: manifesto de períodos/escopos e semântica de empty,
      unavailable, stale e error.
- [ ] `DATA-COHORT-GRANTS`: papel, coorte, reporting scope, validade,
      delegação e revogação por perfil.
- [ ] `DATA-V2-V3`: critérios de equivalência, divergência máxima e janela
      shadow.

## Aprovações comerciais

Para cada engine, preencher um registro separado. Engines:

`simulator.wf13`, `simulator.wf14`, `simulator.wf15`, `simulator.wf16`,
`simulator.caixa`, `goals.dv`, `goals.partnerships`, `points.ranking`,
`ranking.broker`, `ranking.manager`, `sla.loss`, `roulette.eligibility`,
`campaign.eligibility`, `awards.calculation`.

- [ ] `COMM-POLICY`: documento oficial, versão monotônica, vigência e owner.
- [ ] `COMM-GOLDEN`: casos de ouro com entradas, saídas, arredondamento,
      limites e tratamento de datas aprovados.
- [ ] `COMM-ELIGIBILITY`: público/coorte, exclusões e source of truth.
- [ ] `COMM-GRANT`: permissão e grant de execução temporal por engine.
- [ ] `COMM-SHADOW`: critérios comparativos sem retornar resultado ao usuário.
- [ ] `COMM-ACTIVE`: critério e autorização separados para promoção active.
- [ ] `COMM-ROLLBACK`: versão anterior válida e regra de revogação do gate.

## Autorizações de mudança remota — sempre separadas

Mesmo com todas as decisões acima aprovadas, obter comandos explícitos e
independentes para:

1. aplicar migrations remotas;
2. provisionar credenciais privadas;
3. alterar workflow n8n/Qlik/Salesforce;
4. iniciar shadow;
5. iniciar canário;
6. executar cutover;
7. aplicar hardening destrutivo;
8. fazer merge;
9. fazer deploy.

Ausência de qualquer autorização significa **não executar**.
