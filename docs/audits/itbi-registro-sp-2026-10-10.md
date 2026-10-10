# Auditoria ITBI e registro SP - 10/10/2026

## Pedido e escopo

Fonte: autorizacao do usuario para corrigir e publicar ITBI e registro e
registrar conhecimento no GitHub e Obsidian. Branch
`codex/itbi-registro-vigente`, base `7a70e93`. Despachante, seguro, juros,
parcelamento documental, regras do pro-soluto, n8n e banco fora do escopo.

## Problemas identificados

- Isencao condicionada a primeiro imovel **e** MCMV; regra municipal exige
  primeira aquisicao **ou** MCMV, com os demais requisitos.
- Aliquota favorecida sem distinguir SFH/PAR/HIS/consorcio de SFI.
- Registro com tabela anterior e multiplicador fixo de compra `0.620879`,
  sem separar os requisitos de SFH, MCMV e origem dos recursos FGTS.
- Falta de datas fiscais, municipio, base de IPTU e confirmacao do contrato.

## Implementacao

- Motor fiscal compartilhado, politica 2026 versionada, fontes publicas e
  bloqueio de vigencias/municipios/beneficios nao validados.
- Campos fiscais explicitos, confirmacao invalidada ao mudar proposta e
  demonstracao de compra e alienacao. Sobreposicao FGTS/item 14.4 fora do
  MCMV e SFH com base fiscal superior ao preco ficam pendentes de cartorio.
- Duas tabelas confirmaveis, ARISP/ISS 2% e 5o RI SP, sem extrapolar o ISS
  de uma serventia para outra. Selecao ausente ou outra tabela bloqueiam.
- Regras completas, limites e manutencao em
  [runbook](../runbooks/documentation-fees-sp.md).
- Verificador de fontes publicas integrado a CI, sem exportar dados pessoais.
- Ajuda, FAQ e guia atualizados para nao ensinar a regra antiga.

## Evidencias e estado

- Fontes municipais, ARISP e 5o RI consultadas em 10/10/2026. Verificador
  confere limites, PDF (SHA-256 na politica) e as 48 faixas do Quinto.
- Primeira rodada local: lint, tipos, build, formatacao e 199 testes focados
  passaram. UI fiscal conferida em 12 combinacoes de pagina/tema/viewport,
  sem overflow nem violacoes Axe na area alterada.
- Suite completa Windows: 2414 passaram, 11 falharam, 6 ignorados; expectativa
  antiga da FAQ corrigida e revalidada, restantes envolveram semantica POSIX
  e timeouts de infraestrutura. Suite Node Salesforce tambem limitada por
  caminhos/permissoes POSIX. Nenhum teste foi desabilitado. Validacao integral
  depende da CI Linux; nova rodada com as duas tabelas e publicacao pendentes.
- Rodada final local: lint, typecheck, build, formatacao e 216 testes focados
  aprovados. Verificador Web confirmou os tres conjuntos de parametros.
  Preview reproduzivel `node scripts/qa/documentation-legal-preview.mjs`
  aprovou valores, invalidacao da confirmacao, bloqueios, geometria e Axe
  nas duas telas. Brilho documental preservado: dois ciclos desktop/mobile,
  sem intervalo invisivel entre os cards. Evidencia local em
  `test-results/documentation-legal-preview/2026-10-10T23-13-44.671Z/result.json`.
- Nao houve migration nem alteracao de contas, permissoes ou dados remotos.
- Resultado continua estimativa sujeita a guia e enquadramento oficial, nao
  promessa de cobranca definitiva ou de beneficio sem documentos.
