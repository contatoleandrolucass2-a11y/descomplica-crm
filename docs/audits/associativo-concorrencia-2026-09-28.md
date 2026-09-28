# Associativo: auditoria e concorrencia

Data: 2026-09-28. Branch: `codex/associativo-auditoria-concorrencia`.
Status: validado e publicado em 28/09/2026, 15:01 UTC.
Release: `3d92b7aaa4fccbfed3f5be33d47688ec8b3bfabb`, PR #102.

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
945 aprovados, seis falhas POSIX preexistentes e um ignorado. Oito testes Node
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

## Resultado integrado

- [PR #102](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/102)
  integrado apos CI verde. [CI da release](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/36437130674):
  validate, release-gates, isolated-restore e promotable-image aprovados.
- Linux: 948 testes Vitest aprovados, quatro skips de plataforma, oito testes
  Node aprovados, 1.042 pgTAP e 20 E2E de navegador aprovados. Lint, tipos,
  build, audit e restore isolado passaram.
- Concorrencia integrada: quatro identidades e quatro contextos isolados;
  duas sessoes com permissao e duas negadas. Burst de 20 requisicoes, zero
  erros, p50 491,93 ms e p95 736,62 ms. Dez referencias seriais e 16 casos
  negativos passaram; propostas, anuais acima de 50% e parcelas extremas
  conferidas nas duas sessoes autorizadas. Nao foram 20 usuarios distintos.
- Nginx isolado: 20 transferencias sem erro, corpos identicos apos descompressao;
  fixture de 2.748.647 para 47.136 bytes, p95 206,05 ms. Nao e medicao da origem real.
- Matriz visual: sete viewports, 140 verificacoes de rotas, 193 capturas e
  verificacoes de acessibilidade. Teclado e larguras equivalentes a zoom CSS
  de 80/100/125/150/200% passaram; nao representa zoom nativo do navegador.
- Dez usuarios QA removidos; zero propostas persistidas. Nenhuma carga sintetica
  contra o feed externo, banco remoto ou clientes de producao.

## Verificacao depois da publicacao

- Checksum do arquivo da CI aprovado; nao houve rebuild no VPS. Docker da CI
  usa digest da configuracao; containerd no VPS usa digest do manifesto OCI.
  Equivalencia comprovada por SHA-256 do arquivo, manifesto e config, vinculo
  entre os digests, label, plataforma e onze camadas. Dois perfis de runtime
  revalidados no host com fixtures, sem rede nem segredos reais.
- Config digest CI: `sha256:2382a4ccf27e0e0759ee96578b219d6f1def2cdb5d38ea74962c7e7c67fbc24b`.
- Manifest digest VPS: `sha256:f0539b72235ef993d55fe68ef84f98e838c4805cd0695a3a0068380c324a8973`.
- Archive SHA-256: `e68a6680d57cea42a7d9cab21095f5868ca614d28784d0819f8a5448ee6e5495`.
- Backup privado root-only de Nginx, ambiente e identidade anterior em
  `/var/backups/descomplica-crm/releases/3d92b7aaa4fccbfed3f5be33d47688ec8b3bfabb.cJ7Pt9`.
  CAS executado; imagem anterior preservada para rollback. Nginx validado e
  recarregado; nenhuma migration, mudanca de DNS ou workflow n8n.
- Health HTTPS confirmou a release. Smoke somente leitura: 12 requisicoes,
  concorrencia maxima quatro, zero erros; health 200, estoque e snapshot 401
  sem sessao. Nao houve teste de saturacao da producao.
- Navegador autenticado passou de erro para estoque disponivel. Nginx registrou
  corpos comprimidos completos de 105.825 bytes (snapshot) e 56.526 bytes (live).
  Nao converter essa comparacao em percentual de velocidade ou SLA.
- Na pagina publicada: quantidade `4294967296` permanece visivel e invalida,
  sem travar; anual ficticia acima de 50% da renda rejeitada; filtro preserva
  valores preenchidos. Console sem avisos/erros. Teste mobile sem overflow
  global; dados ficticios limpos por reload e viewport restaurado ao terminar.
- A fonte live ainda informa atualizacao em 07/08/2026. Transferencia atual
  nao certifica atualidade comercial: investigar a origem em demanda propria,
  sem substituir datas ou dados por suposicao.
- Divergencia preexistente WF13/arquivo permanece pendente de autoridade
  comercial. Nenhuma nova formula, taxa ou politica foi adotada nesta auditoria.
