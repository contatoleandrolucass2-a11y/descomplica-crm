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
- CI inicial `38094607547`, commit `727662d`: validate Linux passou, inclusive
  suite completa, fontes e build. Ajuda refinada antes da nova rodada para
  explicitar que a sobreposicao da cobranca conjunta permanece bloqueada.
- CI `38094894492`, HEAD `7c343bd`, captura limpa `863a8b1` com arvore identica:
  validate, restore, banco/advisors, guia e autorizacao/E2E aprovados. As 242
  auditorias de acessibilidade passaram. Falha funcional restrita a densidade
  inicial de Calcular Documentacao: 1782 px para limite de 1200 px em desktop.
  Onze referencias visuais dessa tela diferiram; outras 231 passaram. Nao
  promover estas capturas enquanto houver falha funcional. Correcao mantem
  todos os dados fiscais em secao expansivel, sem relaxar limites do QA.
- Correcao local de densidade: preview sintetico com 1151 px em 1440, summary
  de 45 px, validacao revela e foca campos pendentes. Impressao preserva dados
  e fontes mesmo com disclosure fechado. Duas telas em 320/1440 passaram
  Axe, geometria e teclado; lint/tipos/build/formatacao e 216 testes focados
  aprovados novamente. Evidencias em `test-results/fiscal-ui/disclosure-result.json`
  e `disclosure-density.json`. Revalidacao autenticada da CI continua obrigatoria.
- Harness com cabecalho equivalente ao real mediu 1183 px. A impressao no tema
  escuro mostrou baixo contraste fiscal; regras de print restritas aos campos
  e notas fiscais agora usam fundo branco e texto escuro, sem alterar temas
  na tela nem formulas.
- Resultado continua estimativa sujeita a guia e enquadramento oficial, nao
  promessa de cobranca definitiva ou de beneficio sem documentos.
- CI `38098284425`, HEAD `63ac726`: 2439 testes passaram, um contrato estatico
  encontrou a nova variavel de auditoria de print antes da auditoria de tela.
  Nome diferenciado para preservar a verificacao original de ordem. Nenhuma
  regra ou limite de contraste foi alterado; nova CI obrigatoria.
- CI `38098773619`, HEAD `58e9448`, captura limpa `194c5e5` com arvore identica:
  validate, restore, banco/advisors, guia e autorizacao/E2E aprovados. O predicado
  funcional original aprovou todas as rotas, temas, acessibilidade, teclado,
  simuladores e zoom. Altura desktop documental de 1183 px, abaixo de 1200.
- Onze capturas da documentacao foram revisadas em todos os tamanhos e temas,
  sem sobreposicao ou truncamento novo; 231 imagens e seus metadados anteriores
  preservados. Promocao transacional pelo helper original, sem mudar limites.
  Artefato `11688070826`, SHA-256
  `f3c6d7ea02ede1204a35d67b93f70d6c77f353b744621e8c33eb90fd9b255c9f`;
  hashes de todas as imagens e da referencia anterior conferidos. Nova CI
  contra as referencias revisadas e publicacao em producao ainda pendentes.

## Publicacao confirmada em 11/10/2026

- PR #177 integrado apos CI `38101674797` integralmente verde. Release
  `1de9f5af9a4fe528b081c4c7b546e4ff667f2b9d`, sem alteracao de arvore no merge.
- CI da main `38103844760`: validate, imagem e restore passaram. A primeira
  execucao de release-gates interrompeu o Axe de Repasse antes de registrar
  violacoes; diagnostico sanitizado nao permite determinar a causa completa.
  Reexecucao somente do job falho, no mesmo SHA e sem relaxar nenhuma regra,
  passou integralmente, incluindo as 242 comparacoes visuais. Todos os jobs
  da release estavam aprovados antes do download da imagem.
- Artefato imutavel `11688274550`; checksum do arquivo conferido antes do load.
  ID de configuracao da CI
  `sha256:4ce03be562cf954e135d0c06364caf81f9bae607dc53d293d8b81feb01e2c99c`.
  ID local/manifesto OCI
  `sha256:4ad95ae561bf9d159acbc348c851894fa538133c8fa6d666abc89d06f3ba36e2`.
  Cadeia index/manifest/config, plataforma linux/amd64, label, manifesto legado
  e onze camadas/rootfs conferidos. Dois perfis de runtime aprovados no destino;
  nenhuma recompilacao na VPS.
- Backup privado verificado em
  `/var/backups/descomplica-crm/releases/1de9f5af9a4fe528b081c4c7b546e4ff667f2b9d.TQUpuU`.
  CAS partiu de `7a70e93e2a1cf8536b7c391893f2e9bcb9fc3c0d`, imagem anterior
  `sha256:94e49f9acc172c5328747e7aaf1fe8931114c428c71604cd1591e4afad389d8f`.
  Rollback preparado antes da troca; nao foi necessario utiliza-lo.
- Container saudavel; health publico retornou `ok` e o SHA publicado. API de
  estoque anonima respondeu 401; as duas rotas afetadas responderam 307 sem
  autenticacao. Na sessao autenticada do navegador, Calcular Documentacao abriu
  e exibiu os campos fiscais e as duas tabelas. Nenhum dado de proposta foi
  salvo ou enviado e nenhuma declaracao fiscal foi marcada em nome do usuario.
- Conhecimento sincronizado no Obsidian pelos hooks e pelo runtime. Este
  registro final e documental: nao requer outro restart da aplicacao.
