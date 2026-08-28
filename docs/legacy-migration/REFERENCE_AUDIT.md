# Auditoria congelada da referência

Auditoria somente leitura em 2026-08-28. Foram usados dados sintéticos e apenas
requisições GET/HEAD. Nenhum HTML, HAR, cookie, token ou bundle compilado foi
versionado.

## Rotas e contratos observados

As nove rotas de Simulação/Discador responderam `200`: hub, cinco simuladores,
Tabelão, Discador e Previsão Final de Semana. O destino aninhado de Previsão no
legado respondeu `404`; no CRM ele foi corrigido para a hierarquia autorizada
do Discador.

O Tabelão e a Tabela Investidor observavam `GET /api/inventory`. A Previsão
observava `GET /api/weekend-forecast?week=...`. A API de estoque antiga era
pública; essa exposição não foi reproduzida.

## Assets congelados

| Superfície      | SHA-256 observado                                                  |
| --------------- | ------------------------------------------------------------------ |
| CSS global      | `866c5380007fc8668d07250be39b454e534fbeaba42dc2e782d04f16bb99433e` |
| CSS do Discador | `27b59097853f5539adf97a90412eac86408160d0b6caf6977f77cd694b09aa4a` |
| WF13            | `549d416ee48f400e38755e569f35666c0dbee9cbb1878e40e981788b42533b44` |
| CAIXA           | `9cf6bb798a8a1a7a2566390af38fe3aca2a391eaaecf2f38f44f90cdcc7c50ef` |
| WF16            | `615a41e0bdcce3b567ee80c708072c44f41908371d4f6f1101ea565685836713` |
| WF14            | `307ed9ec45f9bcb46e03cfc5a7fc21f3e995a804eba3dcc50c464e2ad0d3ede2` |
| WF15            | `4540fa0a11abf5a150466349c07907af3f0110ecee247e594e6c741dd36bf877` |
| Tabelão         | `f872492a0fcb18651b55593cf7bb93c8a5397f665c458ba9cced01058cdcc815` |
| Previsão        | `52cb4c8e62369f6bbff70da43b439e01c49071ec3b156cb66e3ee15e786f9771` |

Os hashes dos quatro motores também estão nos módulos e nos casos de ouro
versionados.

## Diferenças intencionais

- autenticação exclusivamente Supabase SSR/MFA, sem “Entrar com ChatGPT”;
- nenhuma chamada do navegador ao domínio antigo;
- nenhum status de unidade sem revalidação oficial;
- nenhuma escrita, telefonia ou integração externa;
- CSS selecionado e namespaceado, não o bundle global;
- valores financeiros calculados no servidor e serializados em centavos;
- Tabela Investidor não calcula quando o estoque não confirma a unidade.
