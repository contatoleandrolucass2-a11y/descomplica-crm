# Catálogo único de páginas — 15/10/2026

## Alteração

A produção consultada continha 17 registros em `app_pages`, enquanto o runtime liberava 27 páginas. Dez páginas eram incluídas por listas suplementares de navegação e não podiam ser configuradas no painel Páginas. A entrega reúne as 27 em `PAGE_REGISTRY`, gera a migration correspondente e apresenta os nomes das páginas nos acessos que as controlam.

Os controles existentes por módulo e o controle único dos simuladores foram mantidos. Nenhuma nova permissão é necessária para as dez páginas incorporadas. Admin e Master mantêm as permissões existentes; os padrões dos demais papéis e as exceções individuais não são alterados. Repasse continua exigindo Admin/Master, além da permissão correspondente.

O catálogo usa uma região de rolagem contínua de até 36 rem, com acesso por teclado e sem paginação. Busca e filtros trabalham sobre todos os registros. A navegação não recria registros ausentes ou desativados.

## Validação local

- `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm format:check` e `pnpm pages:check`: aprovados.
- `pnpm lint`: aprovado, com um aviso preexistente em `scripts/qa/connected-systems.mjs`.
- `pnpm test`: 3.063 testes Vitest aprovados, 84 ignorados; 572 testes operacionais Node aprovados, quatro ignorados; 531 testes do coordenador aprovados, 13 ignorados por dependerem de Linux. A CI Linux continua obrigatória.
- `pnpm audit --audit-level high`: nenhuma vulnerabilidade conhecida.
- Gitleaks: nenhum segredo encontrado. Um log ignorado de um ambiente sintético anterior foi preservado fora do checkout, com permissão 0600.
- Ensaio completo: 55 migrations, 1.441 verificações pgTAP na origem e na restauração; lint e advisors aprovados; dados, proprietários e privilégios efetivos preservados.
- Ensaio compacto: 123 verificações aprovadas em PostgreSQL isolado, sem rede nem portas publicadas. Confirma 27 páginas, ausência de duplicatas, preservação de uma desativação após reaplicar a migration, ausência de novos padrões para os demais papéis e manutenção de RLS/grants.
- Navegador local, conta sintética: 27 linhas disponíveis na mesma lista, rolagem por teclado, busca por Rotina, filtro Inativas, ativação persistida e busca por página na matriz de acessos. Layout desktop e móvel de 390 pixels sem overflow horizontal da lista.

## Estado de publicação

A implementação e a validação local estão concluídas. CI, integração e promoção precisam ser confirmadas pelo SHA exato. Este registro não comprova publicação em produção. A publicação deve aplicar a migration aprovada e usar o coordenador com consulta, travas compartilhadas e CAS conforme DEPLOY-001.
