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
- Navegador local com Master sintético: caixas individuais de Comercial e Configurações marcadas por herança, marcas RIVA/DIRECIONAL marcadas e 27 páginas na região de rolagem contínua. O contador exclui controles técnicos ocultos e a antiga permissão compartilhada de etapas.

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
