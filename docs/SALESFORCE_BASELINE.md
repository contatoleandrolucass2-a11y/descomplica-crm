# Baseline Salesforce para a primeira ingestão

## Decisão

A baseline vigente foi atualizada em 7 de agosto de 2026 porque a diferença
observada após a coleta validada de 6 de agosto veio de registros legítimos
criados na fonte depois do snapshot, não de perda, mudança de escopo, filtro ou
transformação. Esta decisão apenas documenta a reconciliação. Ela não autoriza
ingestão, ativação do n8n ou escrita no Supabase.

## Contagens vigentes

| Fonte         | 06/08 21:38:49 UTC | 07/08 auditado | Diferença |
| ------------- | -----------------: | -------------: | --------: |
| corretores    |                 27 |             26 |        -1 |
| contas Imob   |                  4 |              4 |         0 |
| oportunidades |             11.914 |         12.299 |      +385 |
| agendamentos  |                816 |            816 |         0 |
| visitas       |                352 |            352 |         0 |
| pastas        |                465 |            465 |         0 |
| vendas        |                595 |            595 |         0 |

O payload vigente contém três views, quinze métricas e 104 participantes de
ranking, correspondentes a 26 corretores nos quatro períodos. Os diagnósticos
permanecem em 63 visitas sem agendamento, 19 pastas fora do recorte de
oportunidades, 18 vendas fora do recorte e 122 pastas aprovadas. Não houve
duplicidade nem remoção de oportunidade entre as duas coletas.

## Reconciliação das 385 oportunidades

Todas as 385 oportunidades adicionais possuem identidade Salesforce estável,
foram criadas e modificadas depois de `2026-08-06T21:38:49.821Z` e estão
presentes no escopo organizacional do mesmo relatório. Nenhuma oportunidade da
baseline anterior desapareceu.

| Classificação temporal                       | Quantidade |
| -------------------------------------------- | ---------: |
| criação em 06/08, hora UTC 21                |        372 |
| criação em 06/08, hora UTC 23                |          1 |
| criação em 07/08, hora UTC 02                |         12 |
| criação em 06/08 no fuso `America/Sao_Paulo` |        385 |
| modificação em 06/08 no fuso local           |        371 |
| modificação em 07/08 no fuso local           |         14 |

As categorias abaixo usam HMAC-SHA-256 com chave efêmera destruída após a
auditoria. Os hashes permitem confrontar grupos sem versionar nomes, IDs ou
outros dados pessoais.

### Status

| HMAC-SHA-256                                                       | Quantidade |
| ------------------------------------------------------------------ | ---------: |
| `dc1f92a822307708656e29b888d035272096a781d8f70111cead815e1870d317` |        379 |
| `0b3ea614d11f471ff9616a1c874ec13943e9834bce930f4bd251963468fbb91d` |          3 |
| `ce8e38e19f40ae08baff67a1f5eadb4181bf68443502634a604038209a87affb` |          3 |

### Corretor responsável

| HMAC-SHA-256                                                       | Quantidade |
| ------------------------------------------------------------------ | ---------: |
| `a610f9c62c773aa1fb0d66c9e1d3831ae335e75fa9244c850ba3ebc9c1c94145` |        135 |
| `226c0fc9db6e34c27c19ca324827eeabc456b0139829458e578769e7b96ab18d` |        120 |
| `7455977ae6773882373e0c066433f50702a7f9645311d93fb4fcdb2872128561` |        118 |
| `6ba7f4bd4f6ec45c68c9d4c3580b31e2f3854eb37c4230b693c76296f9d9b1fc` |          3 |
| `88ca8ba69633f9926d72b9de300fc615cd48955b888a18a1b227765a6e26676c` |          3 |
| `e01f0b97cd5754da4bc0cb6040dc763abadc3f36a4666d669ff78abb6a32694b` |          3 |
| `e3dfee2c77d99f5eafda3d800c036eae8b9223099e58317ce43ca39ab6a94a6d` |          3 |

### Proprietário Salesforce

| HMAC-SHA-256                                                       | Quantidade |
| ------------------------------------------------------------------ | ---------: |
| `e20150f10c27357dd4af50b28fcb4b88612d5cb9f8903ae96b57269084dca203` |        138 |
| `3e8a37f135522ed33dccbb9b324cfbdab324e4ec28b9f648c489ce9f87af7e97` |        123 |
| `86b5f07aa7fcac308a3b24d8d82617f44c2a9abb0dbf89db2094979436f6bb2d` |        118 |
| `031d162bf6f33ee2b8cd3d72e5c08d394ca6696423b189f97e8c8e1067e43586` |          3 |
| `0ce43725451753161b46ff35e92e63339f43178e76151312b113c54049e02397` |          3 |

### Origem

| HMAC-SHA-256                                                       | Quantidade |
| ------------------------------------------------------------------ | ---------: |
| `9ad3e0b4674886c8bf28e56c7635d1a592fb4ad059304cd5b6dfeb7154ffba00` |        367 |
| `295a1bc263e2c8728da6b1775cf062398868463bda0bea01199da516f3e2aa68` |         14 |
| `9b7605ecc6fdfcc4769ab275d01c75be11c29861953e765db467ee4e847d1274` |          1 |
| `ac47bc903052245dc5ffba5f46d9b499aba05d3549e9e93c8cd520a5736d2319` |          1 |
| `e490b81c6131dbf1cb436b4ca0252ff277b805d98ed5a5f88e7aee5a5b50d687` |          1 |
| `fd933a0c8253484d101e8cc6982589c304b7499f8eb875d49be47b8b178ba1f4` |          1 |

## Corretor e ranking

O corretor ausente é identificado sem nome por
`sf-contact-f24943fc0580f419405a77fa927120a3`. O contato continua existente,
não foi excluído e teve seu status alterado em `2026-08-07T00:36:45Z`. A
definição do relatório de corretores não muda desde 3 de julho. A alteração de
status explica sua saída do relatório e remove exatamente seus quatro
participantes: `month`, `last_week`, `week` e `today`.

O HMAC do nome é
`62b7734e46642f58c481d003cca209e96b4f11cc2f4635d558146eab89c30cee`.
Os HMACs de status anterior e atual são, respectivamente,
`2af131e9a9fa9710f0bafb1799ec9a137589560871148fd40d5a13afaea7b77a`
e `886a9713f42c6a5a821011a7e2d0cdf8a15e750f41ca50c19ed146df19321560`.

## Filtro, executor e visibilidade

- O relatório de oportunidades permanece com escopo `organization`, filtro de
  data em `Opportunity.CreatedDate` e definição sem alteração desde
  `2026-07-21T02:47:45Z`.
- O usuário executor atual é `STANDARD`, usa `America/Sao_Paulo` e corresponde
  ao único hash de usuário encontrado nos 16 logins auditáveis de 6 e 7 de
  agosto. Três logins bem-sucedidos desse mesmo usuário precedem a baseline.
- O HMAC do executor é
  `46b1c32b49c581b35b16dfb07253eab054e479e02e2ed43f4706ce930457822f`.
- Não há evidência de mudança de usuário, escopo, definição, transformação ou
  visibilidade. A diferença corresponde a criação tardia na própria fonte.
- Os doze registros com data UTC em 07/08 foram criados entre 02:00 e 02:59 UTC,
  ainda em 06/08 no fuso `America/Sao_Paulo`. O filtro Salesforce usa o fuso do
  executor; por isso a inclusão está correta.

## Evidência protegida

O relatório completo, contendo somente contagens e HMACs, fica fora do
repositório em backup `root:root` modo `0600`. Seu SHA-256 é
`6758d9336f6a7f74f3bc931b8e11606968c55a85a32511064556d4e9ff749803`.
Nenhum valor de célula, nome, token, cookie ou credencial foi copiado para o
repositório.
