# Contrato de policy comercial v1

## Autoridade exigida

Uma policy só pode ser importada quando o pacote oficial informa, sem inferência:

- chave do motor e versão monotônica;
- vigência, timezone `America/Sao_Paulo` e razão da mudança;
- owner operacional e backup distintos, já ativos em
  `private.crm_integration_owners`;
- referência de evidência rastreável;
- entradas, saídas e expressão completas;
- pelo menos um caso de ouro aprovado, com input e output exatos.

O fuso-base vem da especificação comercial aprovada e permanece fixo em
`America/Sao_Paulo`; regras como dia útil e horário de corte ainda precisam vir
em cada policy oficial. O documento não aceita campos extras. Chaves têm formato canônico lowercase;
UUIDs e timestamps são normalizados. Decimal usa string, nunca JSON number.
`0`, `null` e indisponível são estados distintos: o contrato v1 não aceita
`null` como substituto de input obrigatório.

## DSL permitida

| Tipo    | Operações                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------- |
| decimal | literal/input, soma, subtração, multiplicação, divisão, mínimo, máximo e arredondamento explícito |
| boolean | literal/input, `and`, `or`, `not`, comparação e condição                                          |
| string  | literal/input e concatenação                                                                      |
| date    | literal/input, adicionar dias/meses e diferença em dias                                           |

Divisão e arredondamento declaram escala de até 18 casas e um modo entre `down`, `up`, `floor`,
`ceil`, `half_up` e `half_even`. Adição mensal declara `reject` ou `clamp` para
overflow de calendário. Datas são avaliadas em UTC como datas civis; a policy
carrega explicitamente o timezone comercial.

Não há `eval`, JavaScript arbitrário, SQL, acesso à rede, relógio atual,
aleatoriedade ou lookup implícito. Expressões aceitam no máximo 24 níveis, 512
nós, 100 inputs, 100 outputs e 100 casos de ouro. Strings/resultados aceitam no
máximo 1.000 caracteres; decimais de entrada/saída têm no máximo 18 casas e 30
dígitos, com intermediários limitados e obrigatoriamente arredondados antes de
sair. O corpo HTTP aceita no máximo 256.000 bytes.

## Verificação e hashes

`pnpm commercial-policy:verify --policy <arquivo>` executa:

1. validação estrutural fechada;
2. normalização de UUID/timestamps e ordenação UTF-8 de inputs, outputs e casos;
3. typecheck de cada expressão;
4. execução de todos os casos de ouro;
5. SHA-256 canônico da policy;
6. SHA-256 do relatório de casos, contendo apenas hashes de input/output.

Com `--manifest-out <arquivo>`, cria exclusivamente um arquivo novo, modo
`0600`, contendo request ID, policy normalizada e os dois hashes. A publicação é
atômica por link no mesmo diretório; falha não deixa manifesto parcial. O
comando não abre conexão de rede nem banco. Arquivo existente não é sobrescrito.

Fixtures em `tests/commercial-engine.test.ts` usam nomes `fixture_*` e evidência
`test-fixture:*`. Elas exercitam determinismo e não são manifesto importável
para homologação/produção.

## Preview e importação

O banco recalcula um hash próprio do JSONB, valida catálogo, versão, owners,
vigência, evidência, contagem de casos e hashes do runtime. O preview retorna
somente disposition, conflitos e `planHash`; não grava policy/gate. O apply:

- exige sessão Master ativa e `crm.commercial_policy.manage`;
- exige o `planHash` revisado;
- serializa por request e por engine;
- exige versão nova estritamente maior que a última; replay/noop idêntico da
  versão existente continua permitido;
- rejeita downgrade, colisão de versão ou request alterado;
- grava versão imutável e comando de importação;
- não cria gate e não habilita execução.

O banco não reimplementa a DSL. A integridade semântica vem do verifier local e
é repetida pelo loader/runtime antes de qualquer execução; objeto estrutural
forjado não possui a atestação privada do verifier. O banco garante envelope,
autoridade, hashes, imutabilidade e autorização. Uma fixture estrutural idêntica
em TypeScript/pgTAP fixa os hashes policy/report para detectar drift.

## Evolução

Mudança de shape/semântica cria `schemaVersion` ou `runtimeVersion` nova. O
dispatch v1 é explícito, seus hashes de ouro são fixados e o documento verificado
fica congelado em memória. Nunca se altera interpretação de um documento v1 já
importado. Policy corrigida usa nova versão; update/delete direto é bloqueado
por trigger.
