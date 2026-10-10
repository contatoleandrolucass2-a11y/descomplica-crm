# Guia do Associativo no cabecalho

Data: 09/10/2026. Branch: `codex/guia-associativo-cabecalho`.
Fonte: pedido direto e dois prints do usuario. Substitui apenas a posicao
inferior do acionador entregue pelo PR #174.

## Escopo

- Botao a direita de Simulador Tabela Associativo, com largura intrinseca,
  padding de 16px e quebra responsiva. Mantem acabamento e animacao existentes.
- Um unico guia, sem modificar conteudo, estado da proposta ou formulas.
- Cabecalho opcional no InvestorCalculator preserva a hierarquia DOM anterior:
  cabecalho e workspace continuam irmaos. Outros simuladores nao o utilizam.
- QA exige alinhamento desktop, quebra sem sobreposicao em celular, largura
  proporcional ao texto, ausencia do acionador no estoque e toque minimo de 44px.
- Nenhuma rota, dependencia, banco, integracao, politica ou permissao modificada.

## Validacao

Oito testes focados aprovados, incluindo browser do contrato de cabecalho.
Primeira execucao excedeu o limite padrao local de cinco segundos; reteste com
30 segundos passou sem modificar os testes ou o limite da CI.
Lint, typecheck e build de 45 rotas passaram. Dois avisos de lint pertencem a
artefatos locais ignorados de auditorias anteriores, sem erros. Guia browser:
18 cenarios, 648 visitas, tres temas, 1440x900/375x812/320x568, nenhum erro de
console; seis combinacoes adicionais de estoque completo passaram. Campos,
filtros e selecao preservados. Capturas da CI confirmam titulo inteiro no celular.

Windows: 2.276 testes Vitest aprovados, seis skips e nove falhas; seis dependem
de semantica POSIX e tres foram timeouts em conhecimento. Reteste isolado dos
22 testes de conhecimento passou. Suite Node executada separadamente: 75/83
passaram, oito falharam em permissoes POSIX/caminhos executaveis. Nenhuma
asserção foi suprimida; o job validate Linux do mesmo HEAD passou integralmente.

## Revisao visual

PR #176. CI `37986779336`, HEAD `fdbf09fb324ebf760dca7e6a81e78a216ead3c54`:
validate, restore, banco, advisors, build, guia e autorizacao/E2E aprovados.
O predicado funcional original da matriz autenticada passou. Somente 11 imagens
do Associativo diferiram devido a mudanca solicitada; capturas revisadas em
sete viewports e nos tres temas, sem sobreposicao ou truncamento do acionador.

Captura limpa `ba192ecf7e8e355f8560b0de4c2817024f520044`, arvore identica ao
HEAD; artefato `11645226430`, ZIP SHA-256
`60c7698d714bc960df60ca083fcace6f124dc573ec57fb6884f07d9e637de772`.
Hashes de todas as candidatas e referencias conferidos; promocao transacional
reutilizou o helper versionado sem mudar predicados ou limiares de 1%/16.
Atualizadas 11 referencias, preservadas as outras 231 imagens e sua proveniencia.
O roteiro do guia tambem retorna ao topo antes da captura do cabecalho, para
nao registrar a rolagem residual da selecao de filtros como corte do titulo.

CI final em verify, integracao e publicacao pendentes.

## Publicacao concluida

PR #176 integrado sem bypass apos CI final `38008213156` aprovada.
Release `7a70e93e2a1cf8536b7c391893f2e9bcb9fc3c0d`, CI main `38011126950`
com os quatro jobs aprovados: validate, release-gates, isolated-restore e
promotable-image. Reteste local final do guia tambem aprovou os 18 cenarios.

- Artefato `11653395680`; ZIP SHA-256
  `3b8dbafd21f110f0709fb1e52c41fc6473f0f07e55cadd60ca049bd5c7bbead4`.
- Imagem compactada SHA-256
  `adeced0d9ec7dd87b52e9a83b965c261402bcbcc6d28f7f2d61037034d106460`.
- Config ID da CI `sha256:23f34fa412c3c75749d2a3898b4b37ed44cab8e2b860a075b0913ff405998001`;
  manifesto/ID local `sha256:94e49f9acc172c5328747e7aaf1fe8931114c428c71604cd1591e4afad389d8f`.
  Cadeia OCI, configuracao, camadas e label verificadas; dois perfis de runtime
  comprovados com a mesma imagem. Sem rebuild na VPS.
- Versao anterior `04a3fd55397a1761a49c7e4144f19d45896e7419`, preservada para
  rollback. Promocao pelo helper existente com lock, backup e CAS.
  Backup: `/var/backups/descomplica-crm/releases/7a70e93e2a1cf8536b7c391893f2e9bcb9fc3c0d.CQDkLh`.
- Health local e publico confirmaram o SHA; container saudavel, APIs de estoque
  anonimas negadas com 401, pagina protegida com 307 e Nginx preservado.
- Sessao real: botao de aproximadamente 147px para o texto, alinhado ao titulo;
  abertura, avanco e Escape aprovados, sem erros de console. Nenhum dado de
  proposta alterado. A primeira leitura mostrou estoque indisponivel depois
  de interrupcao do navegador; Tentar novamente recuperou a consulta. Nao foi
  necessario mudar dados ou configuracao. Captura final local ignorada pelo Git.

Registros de pendencia anteriores descrevem as etapas, nao o estado final.
