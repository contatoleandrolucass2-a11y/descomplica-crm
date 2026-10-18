# Catálogo único de páginas — 15/10/2026

## Alteração

A produção consultada continha 17 registros em `app_pages`, enquanto o runtime liberava 27 páginas. Dez páginas eram incluídas por listas suplementares de navegação e não podiam ser configuradas no painel Páginas. A entrega reúne as 27 em `PAGE_REGISTRY`, gera a migration correspondente e apresenta os nomes das páginas nos acessos que as controlam.

A resposta do usuário definiu caixas independentes por página, com simuladores juntos. Foram adicionadas treze permissões, separando Gestão, Rotina, Repasse, cada etapa e cada página de configurações. O catálogo contém vinte páginas com controles próprios e sete destinos de simuladores agrupados. Admin e Master herdam todas as chaves implantadas. Padrões e exceções dos módulos anteriores são copiados uma única vez para preservar o acesso existente. As permissões de dados, visões e operações continuam sendo exigidas pelas respectivas funções. Repasse permanece restrito a Admin/Master.

Proxy e guards consultam o registro persistido sob RLS: ausência, negação, erro e desativação impedem abrir a URL. A Rotina também exige seu acesso próprio nas APIs e nas quatro RPCs. O código aceita o vínculo antigo somente enquanto aquele vínculo ainda estiver no banco, para permitir promover o runtime compatível antes da ativação das novas chaves. A ordem de ativação consta no runbook.

O catálogo usa uma região de rolagem contínua de até 36 rem, com acesso por teclado e sem paginação. Busca e filtros trabalham sobre todos os registros. A navegação não recria registros ausentes ou desativados.

## Validação inicial, antes da separação por página

- `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm format:check` e `pnpm pages:check`: aprovados.
- `pnpm lint`: aprovado, com um aviso preexistente em `scripts/qa/connected-systems.mjs`.
- `pnpm test`: 3.063 testes Vitest aprovados, 84 ignorados; 572 testes operacionais Node aprovados, quatro ignorados; 531 testes do coordenador aprovados, 13 ignorados por dependerem de Linux. A CI Linux continua obrigatória.
- `pnpm audit --audit-level high`: nenhuma vulnerabilidade conhecida.
- Gitleaks: nenhum segredo encontrado. Um log ignorado de um ambiente sintético anterior foi preservado fora do checkout, com permissão 0600.
- Ensaio completo: 55 migrations, 1.441 verificações pgTAP na origem e na restauração; lint e advisors aprovados; dados, proprietários e privilégios efetivos preservados.
- Ensaio compacto: 123 verificações aprovadas em PostgreSQL isolado, sem rede nem portas publicadas. Confirma 27 páginas, ausência de duplicatas, preservação de uma desativação após reaplicar a migration, ausência de novos padrões para os demais papéis e manutenção de RLS/grants.
- Navegador local, conta sintética: 27 linhas disponíveis na mesma lista, rolagem por teclado, busca por Rotina, filtro Inativas, ativação persistida e busca por página na matriz de acessos. Layout desktop e móvel de 390 pixels sem overflow horizontal da lista.

## Validação das permissões individuais

- `pnpm test`: 3.073 testes Vitest aprovados, 84 ignorados; 572 testes operacionais Node aprovados e quatro ignorados; 531 testes do coordenador aprovados e 13 dependentes de Linux ignorados. Dois testes adicionais de unicidade de páginas e separação entre leitura e escrita de Rotina passaram na suíte direcionada de 69 testes.
- `pnpm lint`, `pnpm typecheck`, `pnpm build` e `pnpm format:check`: aprovados. O lint mantém somente o aviso preexistente citado acima. Gitleaks não encontrou segredos.
- 1.441 verificações pgTAP aprovadas no schema completo; 138 verificações aprovadas no ensaio compacto, incluindo acesso isolado à Rotina sem Dashboard, negação no banco e preservação das exceções anteriores.
- Ensaio das 58 migrations em dois projetos locais independentes: 1.441 verificações na origem e 1.441 após restauração, com lint e advisors aprovados. Dados, proprietários e privilégios efetivos foram preservados. O ensaio não representa uma restauração do histórico remoto compacto.
- Navegador local com Master sintético: caixas individuais de Comercial e Configurações marcadas por herança, marcas RIVA/DIRECIONAL marcadas e 27 páginas na região de rolagem contínua. O contador exclui controles técnicos ocultos e a antiga permissão compartilhada de etapas.
- Uma segunda conta sintética, com somente `pages.view` e `crm.management.routine.view`, entrou pela rota inicial diretamente na Rotina. A abertura direta de Dashboard foi bloqueada. O layout compartilhado aceita permissões individuais; hubs e links entre etapas consultam o catálogo autorizado. Após MFA e na tela de acesso negado, o início é resolvido pela rota `/`, sem presumir acesso ao Dashboard.

## Captura Linux e revisão visual

A execução `38819023825` foi aprovada no SHA de captura
`ec191f6bf71d1940ffbfa6feb7a656e89a951211`, com árvore idêntica ao candidato
`d9775f0f2e547e8ffd0d95327bad6817a53e20ce`. A árvore estava limpa; o hash do
manifesto anterior e os 242 hashes e tamanhos das imagens foram conferidos.
Somente 22 imagens mudaram: onze de Usuários e onze de Páginas. As outras 220
permaneceram idênticas. A procedência completa consta no README das referências.

Passaram 154 verificações responsivas, 88 de temas, 242 de acessibilidade,
110 de zoom, teclado e jornadas. A revisão manual verificou desktop e celular
nos temas claro e escuro. Os limites de comparação e densidade não foram
ampliados. A categoria de permissões tem rolagem de até 32 rem; a lista de
páginas mantém 36 rem e contém o posicionamento de seus rótulos acessíveis.

A prévia local foi reaberta a pedido do usuário em `127.0.0.1:3012`, com uma
conta Master sintética: 37 controles visíveis marcados por herança, incluindo
RIVA e DIRECIONAL, e 27 registros no catálogo contínuo. A porta 3000 pertence
a outra cópia local e não foi alterada. A CI normal do commit final e a
publicação permanecem pendentes.

## Estado de publicação

A versão final com caixas individuais está em validação. CI, integração e promoção precisam ser confirmadas pelo SHA exato. Este registro não comprova publicação em produção. A publicação deve aplicar a migration aprovada e usar o coordenador com consulta, travas compartilhadas e CAS conforme DEPLOY-001.

## Prioridade solicitada: Master com todos os acessos

Em 15/10/2026, o usuário pediu primeiro a liberação integral para todos os
Master. A consulta remota encontrou dois usuários Master ativos, 23 de 25
padrões e nenhuma negação individual. Faltavam somente RIVA e DIRECIONAL.

A migration `20261015201949_master_all_permission_defaults.sql` foi validada
com 51 testes de interface, 124 verificações compactas e 180 verificações de
hierarquia. Aplicada pelo conector Supabase como `master_all_permission_defaults`
às 20:22 UTC, sob as travas compartilhadas da VPS e com o runtime atual
`d83c22d510478ee089f8c5cb5969a488451d433b` confirmado. Não houve promoção de imagem.

A consulta posterior confirmou 25 de 25 padrões, dois Master, nenhuma negação
individual e nenhuma permissão efetiva ausente. Os padrões dos outros papéis
continuaram com o mesmo digest. Houve alterações de exceções por outra sessão
às 20:21:44 UTC, anteriores à aplicação; elas foram preservadas. A migration
não escreve exceções individuais. Os advisors mantiveram as contagens
preexistentes: segurança 13/3/26/1 e desempenho 11/5.

A sessão de produção no navegador chegou à tela de login durante a conferência;
a confirmação efetiva foi feita por consulta do banco, além dos testes da
interface. O pacote de páginas permanece em desenvolvimento, agora com caixas
individuais por página e simuladores agrupados, conforme a resposta do usuário.

### Leitura independente das páginas antes da publicação

A revisão final reproduziu a dependência indevida dos dados de Etapas, Metas e
Pontos em permissões dos módulos anteriores. A migration
`20261016000120_individual_page_data_access.sql` altera somente cinco policies de
leitura. Preserva canais, MFA, contas ativas, grants, escrita e os acessos
preexistentes do Dashboard e Ranking. Uma etapa isolada consulta somente as
etapas autorizadas, sem exigir ou expor resumos financeiros. Metas DV e Parcerias
continuam separadas por perfil. A ativação ocorre na mesma transação das chaves
individuais e das RPCs de Rotina.

Os 27 novos testes pgTAP cobrem concessões e negações por etapa, canal e perfil,
páginas desativadas, contas inativas, sessão de recuperação e ausência de escrita.
A suíte completa passa a 1.468 testes e o contrato compacto a 165. O manifesto
passa a 59 migrations. Esta nota descreve a implementação; publicação permanece
pendente dos gates completos no SHA final.

Validação final local: lint sem erros, tipos, build, formatação, 3.093 testes
Vitest, 572 testes Node e 531 testes do coordenador aprovados (os testes de
Linux permanecem obrigatórios na CI). O ensaio de restauração executou as 59
migrations e passou 1.468 testes em cada banco independente, preservando dados,
proprietários e privilégios efetivos. O contrato compacto passou 165 testes.
Uma sessão sintética pela aplicação abriu somente Oportunidades no canal
permitido; Dashboard e Vendas negados retornaram HTTP 403, e o canal negado
renderizou acesso restrito sem dados. O Next.js pode iniciar HTTP 200 antes
do bloqueio de canal por streaming; o guard e a RLS negam o conteúdo. Os dados
sintéticos e as exceções temporárias foram removidos após a verificação.

## Reconciliação operacional em 16/10/2026

A CI `38827702755` concluiu com sucesso no candidato `3b44e0ba`. A consulta
posterior identificou produção em `b9377a10`, publicada em
`2026-10-16T02:59:30.399Z`, e revisão remota `b5458ff5`. O deploy anterior
não foi executado; a branch incorporou o novo `main`, preservando Meta,
Ranking e Qlik. As referências visuais foram compostas por rota, mantendo
22 imagens de Usuários/Páginas e 220 da revisão remota. Todos os hashes e
tamanhos coincidiram com os arquivos. O inventário combinado contém
60 migrations e 1.722 asserções pgTAP; exige nova CI completa antes de publicar.

A integração passou em lint, tipos, formato, build, auditoria de dependências e
Gitleaks. Vitest concluiu 3.402 testes, com 86 skips; os testes Node concluíram
1.178 casos, com cinco skips; o guard de publicação concluiu 703 casos, com
14 verificações físicas reservadas ao Linux da CI. A execução inicial com
concorrência livre excedeu prazos na máquina carregada e foi interrompida;
a execução completa com dois workers passou sem ampliar nenhum timeout.
O ensaio local de 60 migrations aprovou 1.722 asserções na origem e 1.722 no
banco restaurado, preservando owners e privilégios. Manifesto:
`4735639196c72ac139221706ba978654fcb781ec9107c9840fb801f50064edb6`.
