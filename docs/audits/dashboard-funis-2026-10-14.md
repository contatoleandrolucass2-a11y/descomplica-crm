# Funis mensais: validacao e publicacao

Implementacao e limites de dados em
[replica do dashboard](dashboard-reference-2026-10-13.md). Proveniencia de
capturas em [paridade visual](../qa/reference-parity/README.md).

## Historico da abertura

Registro transferido integralmente de ATUALIZACOES.md para respeitar o limite
de 256.000 bytes do exportador; nao altera evidencias, regras ou autorizacoes.

- Pedido: incluir os graficos em funil no Comparativo mensal de /app conforme
  print fornecido. Origem descomplicapro.com.br somente leitura; dados atuais
  do CRM preservados. Nao altera politicas, fontes remotas ou n8n.
- Consulta14/10 04:50:56Z: main792320ba e CI38506931120 success; health publico
  HTTP200/status ok/version792320ba037ea48655739aaeefe5295b95c33631. Fontes:
  GitHub branches/main, actions/runs e crm.descomplicapro.com.br/api/health.
- Checkout anterior db7116c limpo pertence ao PR documental217 ainda aberto;
  nova branch codex/dashboard-funis-mensais parte de main792320ba. Registro
  documental anterior permanece preservado em sua branch, sem reverter mudancas.
- Runtime context/search consultados; notas truncadas nao usadas como prova.
  Print local inspecionado. Web fetch falhou; leitura pelo navegador confirmou
  seis blocos e cinco etapas na origem. O print inclui tambem Pastas aprovadas.
- Implementacao: seis funis HTML/CSS com seis etapas, dados atuais e ausencia
  distinta de zero. Aprovadas nao tem serie mensal no dashboard; ranking nao
  substitui essa metrica. Mantida indisponivel ate contrato proprio validado.
  Fontes: dashboard/catalog.ts, presentation.ts e ops/salesforce/transform.mjs.
  Dezoito testes de componente, tipos e 74 checks QA sinteticos aprovados;
  tres temas/larguras, sem overflow ou Axe. Desktop4.704px abaixo de4.800px.
  Fonte: test-results/dashboard-report/report.json. Lint/build locais passaram.
- Consulta14/10 05:17Z: CI38515347098/aa5c835 validate aprovado no Linux:
  2.807 aplicacao/79 skips,241 coletor,124 release. Main/faae8e9 integrado,
  preservando Rotina. Falhas Windows de timeout/ACL/symlink registradas na
  auditoria; nenhuma assercao relaxada. Navegador, baseline e deploy pendentes.
- CI38515347098: banco/restore/E2E e predicado visual funcional aprovados;
  apenas11 imagens /app mudaram. Artefato11873042399 revisado e promovido em
  05:55:40Z, preservando231 imagens e limiares. Captura20aed961 tem arvore igual
  a aa5c835; fingerprint1289963a reproduzido com apenas19 outputs QA e diff
  vazio. Flag dirty mantido; prova especifica, nao reutilizavel. Fontes e hashes
  completos na auditoria/README de paridade. Nova CI verify e deploy pendentes.

## Retomada e integracao

- Retomada longa: Git comum confirmado, checkout de209f4 limpo, context/search
  repetidos e origem atualizada. Consulta11:41:14Z: main/faae8e9 e CI38514527676
  success; health publico HTTP200/ok/versionfaae8e9efa487c44d01b991a3949ce1627ad2980.
- PR218 aberto, mergeable/clean, head de209f4. CI38519492545 concluida com
  validate, restore e release-gates aprovados; imagem nao se aplica ao PR.
  Fontes: GitHub PR218/actions, git fetch e /api/health, sem login nem dados
  privados. Funis implementados e validados, ainda nao integrados/publicados
  nessa consulta.
- Houve interrupcao da espera pela ferramenta; o resultado da CI foi relido,
  sem presumir sua conclusao a partir do estado anterior. Nova consulta de
  versao/data/CAS permanece obrigatoria no minuto da publicacao.
- PR218 integrado em16f458720406e76efcd1eda8a1eeb791509800a3. CI de main
  38558435232 em execucao; nao publicar antes dos quatro jobs aprovados.
- Primeiro sync da retomada falhou: ATUALIZACOES.md tinha256.725 bytes,
  acima de256.000. Historico desta tarefa transferido para este documento;
  exportacao deve ser reexecutada e conferida, sem ampliar limite ou remover
  evidencias. A falha de sync nao mudou o resultado observado no GitHub/site.
- Sync reexecutado com sucesso depois da transferencia; hook existente tambem
  confirmou synced ao criar codex/dashboard-funis-publicacao de16f4587. Nenhum
  hook ou limite global foi instalado/alterado por esta tarefa.

## Validacao final e publicacao

- [PR218](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/218)
  integrado no SHA `16f458720406e76efcd1eda8a1eeb791509800a3`.
- [CI main38558435232](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/38558435232)
  concluida com sucesso em 14/10/2026 12:20:49Z: validate, isolated-restore,
  release-gates e promotable-image. Lint, tipos, testes e build aprovados no
  Linux; 1.323 testes de banco e 19 E2E passaram. A matriz verify confirmou
  154 checks responsivos, 88 de temas, 242 de acessibilidade, 242 comparacoes
  de imagem e 110 de zoom. Nao houve reducao de limiares ou skips adicionais.
- Artefato `11890757475`, baixado somente depois dos quatro jobs aprovados:
  `promotable-image-16f458720406e76efcd1eda8a1eeb791509800a3`.
  ZIP GitHub: `sha256:a52e852d5a6a01325fcb56f6749111ca965ef26ca0e1f5a91eaf7994d7df4c39`.
  `image.tar.gz`: `sha256:51a41cee1edcf788738940cb5e8c485047fd60c0419750f3550b65219cb18cfe`.
  Checksum e revision conferidos; nenhuma recompilacao na VPS.
- ID de configuracao da CI:
  `sha256:96bc4d4d462a4175ab8b6f803b82ce256ce1ca692fec75c73e60d38a4a74ed2e`.
  ID do manifesto no containerd:
  `sha256:827a8f9e0a183eedf87c9aabc543973f4460c591284a0f399f015dd446b2e041`.
  Prova recalculada sobre o arquivo: index, manifesto, configuracao, tamanhos,
  plataforma linux/amd64, label, manifesto legado e 11 camadas tar coincidentes
  com RootFS.Layers. `image:prove` aprovou os dois perfis na mesma imagem.
- Backup privado verificado byte a byte de production.env e ledger em
  `/var/backups/descomplica-crm/releases/16f458720406e76efcd1eda8a1eeb791509800a3.Th2puT`;
  diretorio root:root0700 e arquivos0600. Imagem anterior mantida. Nenhum
  conteudo privado copiado para o Git ou para estas evidencias.
- Baseline consultada novamente em12:24:29Z: SHA
  `faae8e9efa487c44d01b991a3949ce1627ad2980`, deployment ID
  `574a7a95-c8e3-480b-80f5-870cec5600d7`, publicado realmente em
  `2026-10-14T05:45:08.644Z`, sem pendencia. Imagem anterior:
  `sha256:067dab81d8b20fe3a833ee7b172aa48427237dfff835939cd2708acbece0c2de`.
- Promocao exclusivamente por `release:production deploy`, com expected ID/SHA,
  candidato exato, CI38558435232 e imagem comprovada. Coordenador revalidou
  main/CI/health, frescor no minuto, locks e CAS. Retorno `deployed`:
  `713b3b88-e489-4153-9057-096c7b044661`, SHA16f4587, em
  **2026-10-14T12:24:35.454Z (09:24:35 America/Sao_Paulo)**. Status posterior
  confirmou o recibo e `pendingDeploymentId:null`.
- Smoke observacional 12:25:01-02Z: `/api/health` HTTP200/status ok/versao
  `16f458720406e76efcd1eda8a1eeb791509800a3`; `/app` HTTP307 para login;
  `/api/dashboard/status` HTTP401 anonimo. GitHub main relido apos a troca
  permaneceu no mesmo SHA. Nenhuma leitura de dados privados da producao.

## Limites e acompanhamento

- A jornada autenticada foi validada com fixtures isoladas na CI, nao com uma
  conta pessoal em producao. A verificacao publicada foi limitada ao health,
  identidade da imagem e fronteira anonima; nao exporta dados de clientes.
- Pastas aprovadas continua indisponivel nos seis funis porque nao ha serie
  mensal propria. Reavaliar somente com contrato e fonte mensal validados;
  ranking, zero ou numero historico nao sao substitutos. Geometria ordinal,
  nao proporcional ao volume; conversoes preservam as cinco series reais.
- Falhas locais Windows descritas na auditoria de referencia nao foram
  ocultadas. A CI Linux canonica passou. Aviso MODULE_TYPELESS_PACKAGE_JSON
  do comando de release permaneceu nao bloqueante, sem mudanca fora do escopo.
- Nenhuma migration, workflow n8n, fonte de referencia, politica comercial,
  conta, DNS ou dado remoto foi alterado. A excecao de captura dirty e limitada
  ao artefato previamente comprovado, nao uma permissao para futuras capturas.
- Registro final segue em branch documental, sem nova promocao de runtime.
  O limite do exportador foi respeitado com indice curado e historico integral
  neste arquivo; a sincronizacao deve continuar sendo conferida a cada ciclo.
- Sync explicito apos o deploy confirmou `synced`, tres documentos, worktree
  bfe40c1501eed9fc e HEAD16f4587. O PR documental registra o recibo sem afirmar
  que seu proprio commit foi integrado ou publicado como runtime.
