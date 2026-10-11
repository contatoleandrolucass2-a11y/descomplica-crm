# Evidencias da integracao do draft CRM para a VPS

Data: 10/10/2026. Branch de desenvolvimento: `codex/aplicar-draft-crm-vps`.

## Estado

Integracao implementada e aprovada nos gates locais, E2E de release e promocao
visual autenticada listados neste documento. A verificacao pos-commit em modo
`verify` tambem foi concluida e aprovada. O PR #178 foi integrado e a imagem
imutavel da `main` foi promovida em producao por CAS no SHA
`ac3d7893c1e679298f54c1f1f8b57d03568715c2`. Backup, rollback e verificacoes
anonimas pos-publicacao estao registrados abaixo. O aceite da release permanece
pendente da jornada autenticada observacional exigida pelo gate 7.

## Proveniencia do draft

Fonte local aprovada:
`/srv/descomplica-design-drafts/2026-10-10/draft-crm-para-vps`.

| Artefato                      | SHA-256                                                            | Uso                                 |
| ----------------------------- | ------------------------------------------------------------------ | ----------------------------------- |
| `manifesto.json`              | `c113f793b50efc36c08a0c2757980725af252d01c474f7ffd9ed773566242e18` | Inventario conferido do pacote      |
| `INSTRUCOES-PARA-O-AGENTE.md` | `9481fedd27a37b8b55526c2e811a83080c62758c5c731960e0b9ac816198a58c` | Regras de integracao e preservacao  |
| `LEIA-ME.md`                  | `e168380da7311ba69d536c629fc36a5912ed144a8e5822c484c33909ee9cf8ed` | Mapa das fontes e limites da previa |
| `outputs/modelo-site.html`    | `a30980e6f2b790b648348d602e1cb07c9de6f0718ce6450ddb58e034f4f1c698` | Referencia visual final aprovada    |

O `approvedPreviewSHA256` do manifesto coincide com o hash calculado de
`outputs/modelo-site.html`. `portableRebuildMatches: true` e
`javascriptSyntaxCheck: passed` descrevem somente a previa transportavel; nao
substituem testes do CRM integrado.

## Correcao incremental de tema e fronteira Administrador — 11/10/2026

- Ranking e Canal de Parcerias deixam de manter ilhas navy nos temas Claro e
  Medio. As superficies agora usam os tokens semanticos claros/cinza-azulados
  do draft; o tema Escuro conserva o navy aprovado.
- Administrador herda a visualizacao do hub e das quatro rotas de simulacao,
  sem receber execucao oficial, gestao de politica comercial ou funcao de
  Master. O status oficial continua `executeAllowed: false` e a tentativa de
  execucao continua negada.
- Contas Administrador formam uma classe protegida: somente uma identidade com
  papel Master pode criar ou promover para Administrador, alterar seu papel ou
  estado, desativar a conta e conceder, trocar ou remover suas excecoes de
  permissao. Nenhuma identidade pode atribuir o papel Master por esse fluxo.
- A fronteira e aplicada na interface, nas Server Actions/RPCs e por triggers
  no banco. A migration remove somente overrides `allow` de Administrador nas
  tres capacidades exclusivas do plano de controle; overrides `deny` de
  Administrador e overrides de outros papeis sao preservados.
- A instalacao limpa das 46 migrations foi aprovada. O pgTAP direcionado
  aprovou 153/153 assercoes, as regressoes relacionadas 214/214 e a suite
  completa 1.141/1.141 em 27 arquivos, tanto na origem quanto no restore.
  Quatro casos adicionais exercitam remocao e bulk `inherit` de override e
  `INSERT`/`DELETE` direto de escopo contra outro Administrador.
- A primeira promocao visual rejeitou corretamente a pagina de Usuarios com
  2.676 px. O aviso foi condensado no cabecalho existente, sem retirar a
  explicacao acessivel; a medicao final retornou a 2.592 px e manteve o teto
  estrito de 2.600 px.
- A matriz autenticada atualizada aprovou 154 checks responsivos, 88 de tema,
  242 Axe, 242 comparacoes, 110 de zoom, 40 checks dos quatro simuladores e 30
  capturas do Associativo. Foram promovidas somente 24 referencias esperadas:
  nove de Ranking, nove de Parcerias e seis de Usuarios; `other=0`.
- A inspecao humana cobriu Ranking e Parcerias em Claro e Escuro no desktop e
  mobile, e em Medio no desktop. Claro e Medio ficaram sem ilhas navy; Escuro
  preservou as superficies navy aprovadas. Usuarios permaneceu responsivo e
  sem overflow horizontal em 390 px.
- Nenhuma tabela Qlik, formula financeira, campo ou motor dos quatro
  simuladores foi alterado nesta correcao.

## Assets incorporados

| Asset no CRM                                  | SHA-256 no CRM                                                     | SHA-256 na fonte                                                   | Observacao                                     |
| --------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------- |
| `public/brand/descomplica-wordmark-light.svg` | `5dcd1383b5e3e2c383fa313580cde02067008bfc8fd5bee33a3c8ec35ad1374d` | `1f2f3534551ac002e0df6e3ef72b7765a02e63a76d5f98c89561d244ffdf3922` | Mesmo SVG claro, normalizado com quebra final  |
| `public/brand/descomplica-wordmark-dark.svg`  | `c089f8f7aba423664d7c30063a098d82abe8d63d49347fe88d798876dbc63398` | `b0e7787677456c2eb0bd4cc211e105afd6a658ba4eee8c1ca586216e602aba93` | Mesmo SVG escuro, normalizado com quebra final |
| `public/integrations/salesforce.svg`          | `e845eff79dde3342dea038aafd5786de7d69ae62527386bebcf4e725053b5514` | `53ef5e2ecc5b3b78ae3ebcc0535dfd349c38440b35cf0edf1e0495bdcaa1ccce` | Mesmo SVG, normalizado com quebra final        |
| `public/integrations/n8n-dark.svg`            | `8e6ff3a85953b1e09b0ec16a25b0f66b38eb77434f7834c0ac3716b952635d9a` | Igual                                                              | Copia integral                                 |
| `public/integrations/n8n-light.svg`           | `9fd7dc879b2119f59fcd4055147257de08620c3db5722329a7d4d8fc502d592e` | Igual                                                              | Copia integral                                 |
| `public/integrations/supabase-dark.svg`       | `6d57804518b7d5b9dadf767cd277e1a389980e1b8cf53138abe01365c8b81628` | Igual                                                              | Copia integral                                 |
| `public/integrations/supabase-light.svg`      | `48fec684d8f9f7b0f93fa94fb4fbaa195d3cb299263c3c0fdaea11b43745ceb3` | Igual                                                              | Copia integral                                 |

## Layout integrado

- Marca horizontal completa, grafite nos temas Claro/Medio e branca no Escuro,
  com seta vermelha constante e sem duplicacao textual do nome.
- Navegacao primaria compacta: Dashboard e etapas autorizadas, Simulacao como
  link direto, Ranking, Parcerias e Administracao. Configuracoes fica no menu
  da conta.
- Administracao apresenta Usuarios, Paginas e Integracoes. A URL existente
  `/app/configuracoes/conectar-sistemas` foi mantida para compatibilidade, com
  nome e breadcrumb de Integracoes.
- Dashboard, etapas, Ranking, Parcerias, Configuracoes, Recurso MKT e telas
  administrativas usam o canvas compacto responsivo dos tres temas, mantendo
  os dados, filtros, estados vazios e contratos ja existentes.
- Hub de Simulacao com seis ferramentas, duas colunas no desktop e uma no
  celular. Documentacao e CAIXA usam a apresentacao aprovada; motores sem
  contrato continuam indisponiveis e nao produzem valores.
- Integracoes mostra Salesforce, n8n e Supabase com os assets do pacote.
  Salesforce deriva estado da API existente e separa sessao, coleta e
  publicacao. n8n e Supabase permanecem `Nao verificado` quando nao existe fonte
  real de status.
- Usuarios carrega seis contas por pagina no servidor. Busca e filtro refazem a
  consulta; rolagem usa `IntersectionObserver`, com botao de fallback, erro e
  fim da lista. Cada pagina carrega somente os papeis e overrides das contas
  retornadas; a Server Action revalida `users.view`.

Nenhum dado demonstrativo, usuario, valor comercial, estado de integracao ou
temporizador da previa foi copiado para o runtime.

## Quatro simuladores preservados

| Rota                                      | Componente existente      | Evidencia estrutural nesta etapa         |
| ----------------------------------------- | ------------------------- | ---------------------------------------- |
| `/app/simulacao/associativo-fluxo-linear` | `AssociativeTableArchive` | Componente, campos e motor nao alterados |
| `/app/simulacao/tabela-direta`            | `DirectTableArchive`      | Componente, campos e motor nao alterados |
| `/app/simulacao/tabela-investidor`        | `InvestorTableArchive`    | Componente, campos e motor nao alterados |
| `/app/simulacao/tabelao`                  | Rota dedicada do Tabelao  | Rota, conteudo e motor nao alterados     |

As regras novas de `simulators.module.css` usam `.hubPage` e `.caixaPage`. As
regras novas do arquivo compartilhado `canvas-layout.css` estao restritas a
`.simulation-tool-navigation` e a
`.documentation-page-shell[data-canvas-layout="documentation"]`. Assim, os
novos canvases nao selecionam o conteudo dos quatro simuladores preservados.
O shell global aprovado muda ao redor das paginas. A matriz autenticada aprovou
40 checks de navegacao das quatro rotas preservadas. O Associativo teve ainda
30 capturas revisadas manualmente.

## Gates comprovados

Ambiente: Node.js 24.19.0, pnpm 11.20.0 e Next.js 16.3.8. Resultados fornecidos
pelo coordenador da integracao em 10/10/2026:

| Comando                        | Resultado                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `pnpm format:check`            | Aprovado                                                                             |
| `pnpm lint`                    | Aprovado                                                                             |
| `pnpm typecheck`               | Aprovado                                                                             |
| `pnpm test`                    | 124 arquivos; 2.292 aprovados; seis ignorados; 83 testes Node operacionais aprovados |
| `pnpm build`                   | Aprovado; 45 rotas no Next.js 16.3.8                                                 |
| `pnpm resources:check`         | Aprovado                                                                             |
| `pnpm qa:e2e:release`          | 19 aprovados; um skip previsto; Associativo concorrente verde                        |
| `pnpm qa:visual:authenticated` | Modo `verify` aprovado; fixtures efemeras removidas                                  |

## PR e CI candidata

| Evidencia         | Resultado                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Pull request      | [#178](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/178), branch `codex/aplicar-draft-crm-vps`            |
| SHA validado      | `78ed7063e010bb8fcacb0e6339a01f65d80cca0c`                                                                                      |
| GitHub Actions    | [CI 38133737505](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/38133737505), concluida com sucesso |
| Jobs obrigatorios | `validate`, `release-gates` e `isolated-restore` aprovados; `promotable-image` ignorado como previsto em PR                     |

A CI repetiu formatacao, lint, tipos, testes, audit, build, replay de migrations,
pgTAP, advisors, E2E de autorizacao, matriz visual autenticada e ensaio de
restore isolado. O PR estava `CLEAN` depois dessa execucao. O commit documental
final nao alterou o runtime depois dessa passagem, e a revisao Codex do SHA
`78ed706` terminou sem novos apontamentos.

A reexecucao documental `38096802698` preservou `validate`, `isolated-restore`,
banco, E2E e 241 das 242 comparacoes. Ela bloqueou somente
`/admin/usuarios` em 1.024 x 768: o e-mail sintetico aleatorio coube em uma linha
em vez de duas, mudando a altura da captura de 4.082 para 4.061 px. A tela nao
teve perda funcional nem divergencia nos quatro simuladores. O cabecalho de
Usuarios foi estabilizado em duas linhas nesse intervalo responsivo, com o e-mail
integral preservado no DOM e em `title`. A reproducao local posterior, com outra
identidade aleatoria, aprovou 154 checks responsivos, 88 de tema, 242 Axe, 242
comparacoes e 110 de zoom; a captura voltou a 1.024 x 4.082 px e ficou dentro da
baseline. A CI final citada na tabela repetiu todos esses gates e ficou verde.

## QA visual autenticado

| Verificacao                    | Resultado                         |
| ------------------------------ | --------------------------------- |
| Responsividade                 | 154 checks aprovados              |
| Temas                          | 88 checks aprovados               |
| Acessibilidade                 | 242 auditorias Axe aprovadas      |
| Baseline                       | 242 comparacoes aprovadas         |
| Zoom                           | 110 checks aprovados              |
| Canvases aprovados             | 22 comparacoes aprovadas          |
| Quatro simuladores preservados | 40 checks de navegacao aprovados  |
| Associativo                    | 30 capturas revisadas manualmente |

A promocao autenticada da baseline ficou verde, com `performed: true` e
`eligible: true`. A integridade exigiu arquivos rastreados, baseline existente
no inicio e arvore sem mudanca durante a captura.

Em `/admin/usuarios`, a captura em viewport de 1.440 px mediu 2.592 px de
altura. A tela apresenta a matriz completa de 23 permissoes e os badges de
acesso efetivo; por isso, o teto estrito foi calibrado de 2.500 para 2.600 px.
O valor observado ficou oito pixels abaixo do novo teto, e a verificacao de
altura continua ativa.

O QA sintetico de Integracoes aprovou nove combinacoes de tema/largura, seis
estados, zoom de 200% e o carregamento dos SVGs de Salesforce, n8n e Supabase.

A verificacao pos-commit `pnpm qa:visual:authenticated`, em modo `verify`,
repetiu e aprovou 154 checks responsivos, 88 de tema, 242 de acessibilidade, 242
comparacoes candidato/baseline e 110 de zoom. As fixtures efemeras foram
removidas ao final.

Essas evidencias comprovam o ambiente autenticado local e a CI do SHA candidato.
O merge, a imagem publicavel e o estado de producao sao comprovados na secao de
publicacao abaixo.

## Reconciliacao com `main` em 11/10/2026

`main` avancou com a politica fiscal SP/2026 do PR #177. O merge local
`bd8c5f69162824f9fa06a560d78a0a2888570df6` preservou esse motor, campos,
fontes e testes e manteve o layout aprovado. A observacao P2 aberta em
Integracoes foi corrigida: `reauth_required` e `unavailable` agora prevalecem
sobre um ciclo de extracao simultaneo; `Extraindo` permanece apenas para uma
conexao utilizavel.

No candidato combinado passaram `pnpm lint`, `pnpm typecheck`,
`pnpm resources:check`, `pnpm documentation:verify-sources`, `pnpm build` com
45 rotas, 126 arquivos Vitest com 2.453 testes aprovados e seis ignorados, e 83
testes Node operacionais. A matriz autenticada em modo `update-baseline` passou
154 checks responsivos, 88 de tema, 242 Axe, 242 comparacoes e 110 de zoom;
tambem repetiu os 40 checks dos quatro simuladores e as 30 capturas manuais do
Associativo.

Somente onze capturas de Calcular Documentacao diferiram. As versoes combinadas
foram revisadas em 1.440 px/Claro e 390 px/Escuro e promovidas
transacionalmente; 231 imagens permaneceram byte a byte. A tela documental
mediu 1.191 px em desktop, nove pixels abaixo do teto funcional de 1.200 px.
O manifesto final preserva a proveniencia do PR #177 e registra a revisao do PR
#178 sem reduzir os limites de 1%/16.

A verificacao pos-commit `4111089`, em modo `verify`, repetiu os 154 checks
responsivos, 88 de tema, 242 de acessibilidade, 242 comparacoes e 110 de zoom;
terminou verde e removeu a conta e as fixtures efemeras.

## Promocao tecnica executada em 11/10/2026

- O PR #178 foi integrado no merge
  `ac3d7893c1e679298f54c1f1f8b57d03568715c2`. A CI de `main`
  [38136053837](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/38136053837)
  aprovou `validate`, `release-gates`, `isolated-restore` e
  `promotable-image`; banco, build, E2E e matriz visual passaram novamente.
- O artefato imutavel `11700958880` teve digest de API
  `sha256:381b2a36ab493fdb5106b7a7757c65d6b3d5181f41d3304b3265e906dc8d660e`
  e o arquivo `image.tar.gz` conferiu com SHA-256
  `ba05b30f37eb06040a54224ab11e9ae269ba104d5960be67d962c1a3d00180e5`.
  A revision, a plataforma `linux/amd64`, a label, a config da CI
  `sha256:3b4432df62d0645b80c1d6ebb3f010781fc6567c799fc6b9f6177d52b7fa9b86`
  e as onze camadas foram comprovadas antes do load.
- O armazenamento containerd representa a mesma imagem pelo manifesto OCI
  `sha256:d21f8ac853c33f0756082bdbe750eb1d4f9d81dbcdce92591e54090d215c9860`.
  Os dois perfis de runtime passaram no destino com a mesma imagem, sem rebuild
  e sem imprimir segredos.
- O backup privado esta em
  `/var/backups/descomplica-crm/releases/ac3d7893c1e679298f54c1f1f8b57d03568715c2.NW7yqB`;
  seu `SHA256SUMS` tem SHA-256
  `c86e487b11cf9a864a2b88474f229ebca2ca47b6167004d8a382c6782118b354`.
  O CAS partiu de `1de9f5af9a4fe528b081c4c7b546e4ff667f2b9d`, imagem
  `sha256:4ad95ae561bf9d159acbc348c851894fa538133c8fa6d666abc89d06f3ba36e2`;
  rollback foi preparado e nao precisou ser usado.
- O container iniciou em `2026-10-11T12:15:11Z`, ficou saudavel na terceira
  sondagem, sem restart nem OOM. Health local e publico retornaram o novo SHA;
  APIs anonimas permaneceram `401`, as rotas protegidas e os quatro simuladores
  retornaram `307`, sete assets retornaram `200` e os headers de seguranca e
  `no-store` foram preservados. Seis linhas iniciais de log nao continham padrao
  critico.
- Nao houve migration, mudanca de DNS, conta, n8n ou dado remoto. As jornadas
  autenticadas foram comprovadas antes do deploy na CI e no QA local; a
  observacao de producao foi deliberadamente anonima. Sem uma sessao produtiva
  ja autenticada e conscientemente disponibilizada para controle interativo,
  nao foram improvisados login, cookie, `storageState` ou conta.
- O conhecimento foi atualizado nos documentos versionados. O comando
  `pnpm knowledge:sync` retornou `not-configured`; a sincronizacao externa com
  Obsidian permanece pendente neste host.

## Pendencia para aceite da release

- O runtime esta ativo e saudavel no SHA publicado, mas o gate 7 de
  `docs/runbooks/automatic-publication.md` permanece aberto: os `307` comprovam
  os guards, nao a renderizacao autenticada com a configuracao e os dados de
  producao.
- Para fechar o aceite, usar uma sessao produtiva ja autenticada e
  conscientemente disponibilizada no navegador controlado pelo usuario. O smoke
  deve ser somente observacional nas telas alteradas e nos quatro simuladores,
  sem enviar formularios, calcular, salvar propostas, alterar tema persistido,
  usuarios, integracoes ou qualquer dado remoto.
- Ate essa evidencia existir, o estado correto e `runtime_publicado`, com
  `aceite_pendente_jornada_autenticada`; a release nao esta integralmente
  encerrada.
