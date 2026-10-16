## 2026-10-10: Integracao do draft aprovado para a VPS

- Status: `runtime_publicado`; `aceite_pendente_jornada_autenticada` no SHA
  `ac3d7893c1e679298f54c1f1f8b57d03568715c2`. Fonte: PR #178, CI candidata
  `38133737505`, CI de `main` `38136053837` e
  `/srv/descomplica-design-drafts/2026-10-10/draft-crm-para-vps`, manifesto
  SHA-256 `c113f793b50efc36c08a0c2757980725af252d01c474f7ffd9ed773566242e18`
  e previa final SHA-256
  `a30980e6f2b790b648348d602e1cb07c9de6f0718ce6450ddb58e034f4f1c698`.
- O layout aprovado e referencia visual, nao fonte de autorizacao ou dados. A
  integracao reutiliza contratos reais, mostra ausencia como ausencia e nao
  importa usuarios, contagens, temporizadores ou estados demonstrativos.
- Navegacao final: Simulacao e link direto para o hub; Configuracoes pertence ao
  menu da conta; Administracao agrupa Usuarios, Paginas e Integracoes. A rota
  historica de Integracoes continua compativel e seus breadcrumbs refletem o
  novo agrupamento sem ampliar permissoes.
- O diretorio de Usuarios deve paginar perfis no servidor e buscar apenas
  papeis, permissoes herdadas e excecoes das contas da pagina. Rolagem continua
  precisa manter alternativa de botao, estado de erro, fim da lista e nova
  verificacao de `users.view` em cada Server Action.
- Os estilos do hub, Documentacao e CAIXA foram escopados. Associativo, Tabela
  Direta, Tabela Investidor e Tabelao conservam componentes, campos e motores;
  40 checks autenticados de navegacao dessas quatro rotas passaram, e o
  Associativo teve 30 capturas revisadas manualmente.
- Evidencia do coordenador: formato, lint, tipos e inventario aprovados;
  Vitest com 124 arquivos, 2.292 testes aprovados e seis ignorados; 83 testes
  Node operacionais aprovados; build Next.js 16.3.8 com 45 rotas. O E2E de
  release passou 19 cenarios, ignorou um previsto e manteve o Associativo
  concorrente verde.
- A promocao visual autenticada passou 154 checks responsivos, 88 de tema, 242
  Axe, 242 comparacoes, 110 de zoom e 22 canvases; `performed` e `eligible`
  ficaram `true`. Integracoes passou a matriz sintetica de nove temas/larguras,
  seis estados, zoom de 200% e carregamento dos SVGs.
- Em `/admin/usuarios`, a matriz completa de 23 permissoes e badges efetivos
  produziu 2.592 px de altura em viewport de 1.440 px. O teto estrito foi
  calibrado de 2.500 para 2.600 px, mantendo somente oito pixels de margem sobre
  a evidencia autenticada e sem remover a verificacao de altura.
- A verificacao pos-commit `pnpm qa:visual:authenticated`, em modo `verify`,
  passou com 154 checks responsivos, 88 de tema, 242 de acessibilidade, 242
  comparacoes candidato/baseline e 110 de zoom; as fixtures efemeras foram
  removidas. Em uma etapa intermediaria, o PR #178 ficou `CLEAN`; a CI
  `38094977306` aprovou os jobs
  `validate`, `release-gates` e `isolated-restore` no SHA `4a8bfc8`. Revisao,
  merge, imagem imutavel e publicacao ainda estavam pendentes naquele ponto.
- A reexecucao documental `38096802698` expôs uma nao determinacao real do QA:
  em 1.024 px, caracteres aleatorios do e-mail sintetico alternavam o cabecalho
  de Usuarios entre uma e duas linhas, com 21 px de diferenca. As outras 241
  comparacoes e todos os gates funcionais passaram. Reservar e limitar duas
  linhas somente no intervalo de duas colunas estabiliza a geometria sem trocar
  identidade, remover cobertura ou esconder o valor de tecnologias assistivas.
  A reproducao local com outra identidade passou as 242 comparacoes e mediu
  novamente 4.082 px no caso de 1.024 px.
- Estados de conexao e extracao Salesforce sao independentes. Quando coexistem,
  `reauth_required` ou `unavailable` deve prevalecer visualmente sobre
  `cycle=running`; "Extraindo" continua reservado a uma conexao utilizavel.
- A combinacao com a politica fiscal do PR #177 alterou somente as onze
  referencias de Calcular Documentacao; 231 ficaram intactas. A captura desktop
  combinada mediu 1.191 px sob teto de 1.200 px, com 242 Axe/comparacoes, 40
  checks dos quatro simuladores e 30 capturas manuais do Associativo aprovados.
- A verificacao pos-commit `4111089`, em modo `verify`, repetiu 154 checks
  responsivos, 88 de tema, 242 de acessibilidade, 242 comparacoes e 110 de zoom;
  terminou verde e removeu a conta e as fixtures efemeras.
- O PR #178 foi integrado sem novos apontamentos. A CI `38136053837` repetiu os
  quatro jobs na `main`; o artefato `11700958880` foi conferido por revision,
  checksum, config, plataforma e onze camadas antes do load. O ID local
  containerd `sha256:d21f8ac` foi provado contra a config CI
  `sha256:3b4432d`, sem rebuild, e os dois perfis de runtime passaram.
- Backup privado, CAS e rollback foram preparados. A producao saiu de
  `1de9f5a` para `ac3d7893`; container, health local/publico, headers, assets,
  negacao anonima e rotas protegidas ficaram verdes, sem restart ou OOM.
  Rollback nao foi necessario.
- Nao houve migration nem mutacao de dados remotos. A cobertura autenticada foi
  concluida antes do deploy; a verificacao de producao permaneceu anonima. Sem
  uma sessao produtiva ja autenticada e conscientemente disponibilizada, nao se
  improvisam login, cookie, `storageState` ou conta: o gate 7 e o aceite final da
  release permanecem pendentes.
- Registro completo: `docs/qa/draft-crm-vps-2026-10-10.md`.
