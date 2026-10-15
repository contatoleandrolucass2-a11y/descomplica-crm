# Cadastro único de páginas e acessos

As páginas comerciais e administrativas liberadas são registradas em `lib/navigation/registry.ts`. O registro alimenta os guards das rotas, os nomes de páginas apresentados na matriz de acessos e a migration do catálogo `app_pages`. O painel Páginas lê o catálogo persistido, incluindo entradas desativadas, por meio da RPC protegida existente.

## Adicionar uma página

1. Criar a rota protegida e manter as validações de permissão no servidor, nas APIs e no banco.
2. Registrar chave, rota, nome, descrição, módulo, permissão, pai, ordem e estado de liberação em `PAGE_REGISTRY`. Cada página deve declarar uma permissão própria em `lib/authorization/permissions.ts`. A única exceção são os simuladores, que compartilham o controle de visualizar e executar. Usar `enforcePageAccess` na página e `requirePageAccess` ou `authorizePageRoute` nas ações e APIs correspondentes, preservando também os gates de dados e operações.
3. Executar `pnpm pages:sync`. O comando gera uma migration versionada com o catálogo completo e os vínculos de permissão para Admin e Master. Revisar a migration antes de incluí-la no commit. Novas páginas não dão acesso automático aos demais papéis. A separação das páginas já existentes copia os padrões e exceções do módulo anterior somente quando cada permissão é criada. Reaplicar não sobrescreve escolhas posteriores.
4. Executar os gates do projeto. `pnpm pages:check`, executado também no build e nos testes, bloqueia rotas não cadastradas, chaves ou caminhos duplicados, pais inválidos e migration desatualizada. Os catálogos de etapas e simuladores também são confrontados com o registro.
5. Planejar a compatibilidade entre runtime e catálogo antes de aplicar a migration. O runtime anterior rejeita permissões desconhecidas: promover primeiro o código que reconhece as novas chaves e ativá-las depois, seguindo o coordenador de publicação, backup e proteção contra deploy concorrente. O comando de geração local não escreve em bancos remotos nem autoriza publicação.

Páginas internas de diagnóstico `read-model-v3` têm uma lista explícita de exclusão do catálogo de navegação e continuam protegidas pelos próprios gates. Uma rota nova não deve ser excluída para contornar a validação.

## Comportamento administrativo

- Cada página tem sua caixa de acesso; os sete destinos de simulação ficam juntos. A busca por acesso também encontra nomes e rotas dessas páginas.
- O catálogo de páginas tem rolagem contínua, acessível por teclado, sem controles de próxima página. Busca, módulo, status e ações continuam funcionando sobre o catálogo inteiro já carregado.
- A sincronização atualiza os metadados, mas não redefine `is_active` de páginas existentes. Não remove exceções de usuários. A cópia inicial das decisões antigas é serializada com alterações concorrentes de permissões.
- A navegação e o bloqueio anterior à renderização usam somente linhas autorizadas e persistidas no banco. Não existe uma lista suplementar que recrie páginas desativadas ou ausentes. Um item negado ou inativo também é bloqueado na abertura pela URL. Os gates de dados, visões e operações permanecem independentes e continuam obrigatórios.
- Restrições adicionais, como Repasse exclusivo de Admin/Master e os gates de execução dos simuladores, permanecem obrigatórias.

## Validação do banco

Além dos testes unitários e do ensaio completo de restauração, conferir o catálogo no contrato compacto de produção antes de aplicar. O registro contém 27 páginas, vinte permissões de páginas fora dos simuladores e uma permissão compartilhada pelos sete destinos de simulação. As treze chaves novas levam o catálogo compacto de 25 para 38 e o completo de 31 para 44. Admin e Master herdam todo o catálogo instalado.

## Ordem da entrega de 15/10/2026

1. Preparar `20261015195915_unified_page_catalog.sql`, que usa somente chaves já reconhecidas pelo runtime antigo. O padrão completo de Master já foi aplicado separadamente por solicitação direta do usuário.
2. Promover a imagem aprovada. O novo código aceita a chave antiga apenas quando ela continua registrada naquela linha do banco; ausência, erro, desativação ou negação por RLS nunca ativam um fallback.
3. Ativar `20261015202643_sync_page_catalog.sql` e `20261015202644_routine_individual_page_access.sql` na mesma transação. A primeira separa as permissões e preserva as decisões antigas; a segunda aplica a permissão de Rotina às quatro RPCs correspondentes. Conservar backup privado dos registros anteriores e validar os padrões, exceções, RLS, APIs e navegação.
4. Após a ativação, um retorno a uma imagem que desconhece as treze chaves exige reconciliação do catálogo. Não promover a imagem antiga com as novas permissões ainda ativas. Correções após uma publicação concluída seguem novo PR, CI e coordenador; não executar um rollback informal.
