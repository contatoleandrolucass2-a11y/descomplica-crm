# Associativo: auditoria e concorrencia

Data: 2026-09-28. Branch: `codex/associativo-auditoria-concorrencia`.
Status: candidato em validacao; CI e publicacao devem ser comprovadas pelo PR.

## Evidencia inicial

- Duas aberturas autenticadas em producao terminaram em `Estoque indisponivel`,
  antes de qualquer ensaio concorrente. Console sem erros JavaScript.
- Health normal, versao `9800281242ea7bc6a6df965253df7b167fd79d07`, ainda sem a
  preservacao de propostas e single-flight do PR #101.
- Nginx registrou HTTP 200 com corpos parciais: snapshot 1.612.897 / 1.752.161
  bytes e live 269.305 / 375.801 bytes. Respostas completas anteriores tinham
  2.846.787 / 1.268.041 bytes. Snapshot privado: 2.846.632 bytes.
- Configuracao ativa nao comprimia JSON. Cliente limita a transferencia inteira
  a 25 segundos, incluindo leitura do corpo. Evidencia consistente com timeout
  de transferencia, nao prova saturacao da CPU ou indisponibilidade da origem.
- Nenhum cookie, estoque, cliente ou proposta real foi exportado.

## Ajustes

- Gzip somente em `/api/inventory` e `/api/inventory/snapshot`, preservando
  autorizacao, `no-store`, origem e limites. Sem cache publico ou mudanca de DNS.
- Contrato live validado antes do cache: objetos com campos textuais utilizados
  pela tela; contagem nula/booleana rejeitada. Autorizacao por requisicao,
  single-flight e retry preservados.
- Enriquecimento financeiro exige identidade de unidade nao vazia e unica nas
  duas fontes; ambiguidades nao recebem valores de outra unidade.
- Erro de anual impede aprovado. Painel e sugestoes usam a mesma verificacao
  monetaria em centavos, inclusive nos limites exatos.
- Parcelas validadas antes de alocar cronogramas; calendario estrito.
- Datas de sinais do wrapper alinhadas ao core existente. Indices das anuais
  elegiveis preservados depois de 15/dezembro.
- Evolucao da obra em linhas de sinais/anuais sem mensal no mesmo mes, sem
  duplicacao. Nao cria linhas para meses vazios. Inicio no terceiro mes mantido;
  nenhuma taxa, ranking ou politica comercial nova.

## Ensaios e limites

- Regressao com 20 chamadas autorizadas/negadas, cache frio/quente/em andamento,
  payload invalido e retry.
- Nginx isolado na CI: JSON sintetico, 20 transferencias, SHA-256 dos corpos
  descomprimidos, negacao 401, `no-store`, `Vary` e bytes antes/depois.
- Release: quatro identidades sinteticas distintas, sessoes isoladas, Next e
  Supabase locais, calculos seriais/concorrentes e campos independentes no browser.
  Feed substituido somente no processo QA local, sem consultar producao.
- Esses ensaios detectam regressao e mistura entre sessoes; nao estabelecem
  capacidade maxima, SLA ou quantidade suportada de usuarios em producao.
- Desktop sem Docker. Banco, browser autenticado e Nginx real exigem CI Linux.
- Diferenca preexistente entre WF13 oficial e simulador de arquivo permanece
  dependente de autoridade comercial. Nao trocar formulas sem fonte aprovada.

## Validacao local

Windows, Node 24.19.0, pnpm 11.20.0: tipos e build passaram; Vitest com
944 aprovados, seis falhas POSIX preexistentes e um ignorado. Oito testes Node
Salesforce passaram separadamente. Audit sem vulnerabilidades conhecidas,
Gitleaks sem achados e inventario de 40 rotas/onze skills validado.
Revisao independente nao encontrou achados acionaveis no diff de cache,
compressao, CI e isolamento QA. Nao substitui os gates integrados Linux.

## Publicacao

Autorizacao permanente: `docs/runbooks/automatic-publication.md` e AGENTS.md.
Build/prova no runner CI, nunca no VPS. Todos os gates verdes, checksum,
image ID, backup, CAS e rollback obrigatorios. Nginx: teste antes do reload.
Confirmar versao, estoque autenticado, negacao anonima e ausencia de novos erros.
Resultados da execucao e versao publicada vinculados ao PR; observacao inicial
preservada, sem alegar capacidade de producao a partir de fixture.
