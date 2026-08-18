# Inventário de políticas comerciais

## Regra de autoridade

Foram pesquisados código atual, migrations, testes, documentação, histórico Git,
PRs e dois exports n8n protegidos capturados em 7 de agosto de 2026. Os exports
permanecem fora do repositório, modo `0600`; seus SHA-256 são:

- `b7ad92f53520fb3bff8277b2d517d5b251c51252e4374655e19dd1a5f199357e`;
- `5a3c6d8d307d158a468aea45ac31b1946261c383e84faa81c30e993fc4770b5f`.

Eles comprovam comportamento histórico, não aprovação, vigência ou autoridade
comercial. Nenhuma política assinada, tabela homologada, proprietário formal ou
casos de ouro foi localizada. Portanto, “implementada” nunca significa
“confirmada por fonte oficial”. O CRM novo mantém todos os motores de simulação
sem submit, fórmula ou persistência.

## Classificação consolidada

| Política                     | Evidência encontrada                                                                       | Classificação                                  | Estado no CRM                             |
| ---------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------- | ----------------------------------------- |
| Fluxo Linear / WF13          | Motor n8n histórico `3xCd2TjfsPpbozDF`, solvers e cache `RANKING.xlsx`                     | Implementada sem fonte; divergente; incompleta | Bloqueada                                 |
| Calcular Documentação / WF16 | Motor histórico `CgilvhfRoj4PGsQR` com faixas e constantes embutidas                       | Implementada sem fonte; divergente; incompleta | Bloqueada                                 |
| CAIXA                        | Nenhum motor dedicado; WF18 é stub e o orquestrador histórico declara não simular banco    | Ausente                                        | Bloqueada                                 |
| Tabela Direta / WF14         | Motor histórico `Jd8XawLpIAvHbgYg`; caller, trigger e schema incompatíveis                 | Implementada sem fonte; divergente; incompleta | Bloqueada                                 |
| Tabela Investidor / WF15     | Motor histórico `5wbldhDymGu0O5KY`; depende de estoque legado conflitante                  | Implementada sem fonte; divergente; incompleta | Bloqueada                                 |
| Pontuação                    | Sete métricas e pesos sugeridos herdados; tabela/RPC sem seed                              | Implementada sem fonte oficial                 | Só funciona após configuração explícita   |
| Bônus                        | `floor(base × visitas/agendamentos)` no código atual                                       | Implementada sem fonte oficial                 | Ativa apenas com pesos e snapshot válidos |
| Arredondamento               | Funil usa `round` por etapa; ranking usa `floor` no bônus; simuladores históricos variam   | Divergente                                     | Não homologado                            |
| Desempate                    | Atual: total, visitas, conversão, pastas, vendas, nome; legado tinha conversões adicionais | Divergente                                     | Não homologado                            |
| SLA                          | Workflow histórico mede “Criada Pelo SLA” como perda, sem exigir perda/fechamento          | Divergente e incompleta                        | Ausente no contrato novo                  |
| Equipe produtiva             | Regras históricas conflitantes; sem IDs/vigência                                           | Divergente e incompleta                        | Ausente                                   |
| Metas                        | Modelo/RPC atual derivados do legado; workflows históricos discordam nas taxas             | Implementada sem fonte; divergente             | Sem seed; Salesforce marca indisponível   |
| Campanhas                    | Nomes/valores somente no legado                                                            | Ausente como política versionada               | Bloqueada                                 |
| Premiações/roleta            | Presença manual e valores hardcoded no legado                                              | Implementada sem fonte; incompleta             | Fonte marcada indisponível                |

As regras de fluxo do WF13 cobertas pelo PDF 2 de 18/08/2026 e pelo asset
observado estão versionadas em `wf13-1.2.0`. Nenhuma regra dos demais motores
foi classificada como “confirmada por fonte oficial”.

## Motores históricos observados

### WF13 — Associativo / Fluxo Linear

O motor histórico recebia contexto, renda, preço, bônus/desconto, financiamento,
subsídio, FGTS, cheque, entrada, sinais e anuais. Usava JavaScript `Number`,
timezone do runtime e fallbacks comerciais hardcoded. Entre os comportamentos
observados:

A correção `wf13-1.2.0` não porta fallbacks ou decisões de aprovação desse
histórico. Ela usa somente a fórmula de fluxo comprovada, o caso de ouro do PDF
2 e os gates Master já existentes; política, estoque e integrações continuam
independentes e fail-closed.

- venda real = preço com kit menos bônus, folga e desconto;
- anuais manuais ou automáticas, correção mensal embutida e vencimento em
  dezembro;
- saldo C46 após subtrair funding, ato, cheque, anuais, entrada e sinais;
- limite fixo de 84 parcelas em um fluxo, enquanto outro workflow calculava
  meses até término da obra;
- vencimentos nos dias 5, 10 ou 15, taxas pré/pós-obra e três indicadores de
  aprovação;
- política obtida de `RANKING.xlsx`, cache de 2 horas e fallback embutido quando
  o cache falhava.

O WF13B descartava cheque/anuais na entrada, calculava comprometimento mas
testava apenas dois de três limites, e um solver podia reescrever “Reprovado”
para “Aprovado”. O fallback torna a política fail-open. Webhooks não tinham
autenticação comprovada; logs/DLQ montavam payloads extensos; a chamada
“idempotente” incluía relógio e gerava nova chave a cada replay. Não portar.

### WF14 — Tabela Direta

O motor histórico continha dois cenários, percentuais de ato/sinais, PRICE,
taxas MIP/DFI, limite de comprometimento, intermediárias e datas. O caller não
entregava os campos exigidos e o workflow não expunha o trigger interno usado
por ele. C1/C2 ignoravam um mínimo recebido; a descrição de cenário discordava
do cálculo. Dinheiro era ponto flutuante e erros retornavam HTTP 200. Não há
fonte/vigência para percentuais, taxas ou limites. Não portar.

### WF15 — Tabela Investidor

O motor histórico produzia quatro cenários fixos de entrada, parcelas e
intermediárias. Aceitava preço fornecido pelo caller mesmo se divergente do
estoque; fazia lookup aproximado e podia escolher o primeiro candidato. Dois
upstreams ativos escreviam a mesma tabela antiga de estoque, sem regra de
precedência. A chave dita idempotente continha relógio e não era persistida. Não
portar.

### WF16 — Documentação

O motor histórico embutia enquadramentos, limites, ITBI, 48 faixas cartoriais,
descontos, custos fixos, prazo/taxa de parcelamento e datas. Não havia
jurisdição, versão, vigência ou fonte oficial. A escolha de data usava a última
ocorrência dos dias 5/10/15 dentro de 120 dias, comportamento incompatível com a
descrição de primeira data. Não portar.

### CAIXA

Não foi encontrado motor que implemente proponentes, SAC/PRICE, cidade, FGTS,
subsídio ou diagnóstico bancário. A rota atual é somente composição visual e
deve continuar informando motor indisponível.

## Metas e produtividade

`crm_funnel_goals` guarda uma linha mutável por perfil/mês. A RPC começa na meta
de vendas e calcula, em ordem regressiva, pastas aprovadas, pastas, visitas,
agendamentos e oportunidades, arredondando cada etapa. O modelo aceita perfis
`dv` e `partnerships`, mínimos de corretor, ritmos semanais e percentuais de
equipe produtiva. Não existe seed oficial.

Dois workflows históricos discordam: foi observado percentual de visitas de
40% em um e 50% em outro, além de 45% para pastas em uma fonte. Equipe produtiva
também variava entre “ativo com alguma produção” e critérios de visita por
gerente. O produtor Salesforce não lê essa tabela e envia
`goalsAvailable=false`; assim, configuração e snapshot ainda não formam uma
política integrada. Valores zero são armazenamento técnico, não meta real.

## Pontuação, bônus e desempate

O catálogo atual mantém sete métricas: roleta em dias úteis, sábado, domingo,
agendamento, visita, pasta aprovada e venda. Os valores sugeridos no código
vieram do CRM legado e não são seed nem política confirmada; o ranking bloqueia
quando não há configuração persistida.

Com configuração válida, a implementação atual faz:

```text
base = soma(contagem × peso)
conversão = visitas / agendamentos, ou 0 sem agendamentos
bônus = piso(base × conversão)
total = base + bônus
```

Roleta é excluída quando `rouletteAvailable=false`. Para gerentes, as contagens
são agregadas por nome, sem ID estável, antes do cálculo. A ordenação atual usa
total, visitas, conversão, pastas aprovadas, vendas e nome; o legado continha
duas conversões adicionais. Fórmula, piso e desempate não têm documento formal
ratificado.

## SLA, campanhas e premiações

O legado lia campos como “Fora do SLA”, “Criada Pelo SLA”, fase e motivo, sem
deduplicar oportunidade. A métrica rotulada como perda por automação contava
toda oportunidade mensal criada pelo SLA, mesmo sem comprovar perda. O
exportador novo omite esses campos para não perpetuar a divergência.

Campanhas, prêmios e roleta aparecem apenas como valores ou ocorrências
hardcoded/manuais no legado. Não há entidade com vigência, público, critério,
acumulação, aprovação ou auditoria. Um campo “Premiação volta ao caixa” foi
observado sem definição oficial. Todos continuam indisponíveis.

## Matriz única de decisões comerciais faltantes

Estas são as únicas respostas comerciais necessárias para iniciar motores;
comportamento legado não será adotado por silêncio.

1. Fornecer, para WF13, WF16, CAIXA, WF14 e WF15, política oficial versionada,
   vigência, aprovador e casos de ouro de entrada/saída.
2. Definir a fonte única oficial de estoque, sua precedência, IDs, moeda,
   remoção/correção e baseline conciliada.
3. Aprovar métricas, pesos, bônus, arredondamento, desempate e fonte de roleta do
   ranking.
4. Aprovar funil/meta por perfil, arredondamento, produtividade de corretor/
   equipe e como a versão vigente se liga ao snapshot.
5. Definir perda por SLA: eventos/status, janela, deduplicação, responsável e
   reconciliação esperada.
6. Definir campanhas e premiações: vigência, público, critérios, valores,
   acumulação, aprovação e auditoria.

Até essas respostas: simuladores, SLA, ranking avançado, roleta, campanhas e
prêmios continuam fail-closed.

## Fundação versionada de runtime

O incremento `commercial-engines-policy-runtime` adiciona somente a estrutura
capaz de receber decisões futuras: catálogo de 14 motores, DSL determinística,
decimal exato, vigência em `America/Sao_Paulo`, owners distintos, importação com
preview, versões imutáveis, casos de ouro obrigatórios, gates `shadow/active` e
ledger sanitizado. Ele não promove nenhuma linha deste inventário a autoridade.
O lookup/audit ficam fora da Data API, atrás do papel dedicado
`crm_commercial_engine`, criado `NOLOGIN`; não existe segredo ou conexão ativa.

Estado documental em 10 de agosto de 2026:

- políticas oficiais importadas: **0**;
- casos de ouro oficiais importados: **0**;
- gates de execução criados/ativos: **0**;
- valores, percentuais, pesos, limites ou prêmios adicionados: **0**;
- integrações com os leitores v2/v3: **0**.

Fixtures automatizadas exercitam apenas aritmética, datas, hashing, isolamento e
falha fechada. Seus valores são sintéticos e não podem ser publicados como
política. Ver
[`docs/commercial-engines-policy-runtime/README.md`](../commercial-engines-policy-runtime/README.md).
