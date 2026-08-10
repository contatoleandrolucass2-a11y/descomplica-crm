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
