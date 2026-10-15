# Cadastro único de páginas e acessos

As páginas comerciais e administrativas liberadas são registradas em `lib/navigation/registry.ts`. O registro alimenta os guards das rotas, os nomes de páginas apresentados na matriz de acessos e a migration do catálogo `app_pages`. O painel Páginas lê o catálogo persistido, incluindo entradas desativadas, por meio da RPC protegida existente.

## Adicionar uma página

1. Criar a rota protegida e manter as validações de permissão no servidor, nas APIs e no banco.
2. Registrar chave, rota, nome, descrição, módulo, permissão, pai, ordem e estado de liberação em `PAGE_REGISTRY`. Se o acesso for independente, declarar a nova permissão em `lib/authorization/permissions.ts`. Se a página compartilhar um acesso existente, informar essa permissão. Os simuladores continuam compartilhando o controle de visualizar e executar.
3. Executar `pnpm pages:sync`. O comando gera uma migration versionada com o catálogo completo e os vínculos de permissão para Admin e Master. Revisar a migration antes de incluí-la no commit. Os demais papéis não recebem novas permissões automaticamente; as exceções individuais são preservadas.
4. Executar os gates do projeto. `pnpm pages:check`, executado também no build e nos testes, bloqueia rotas não cadastradas, chaves ou caminhos duplicados, pais inválidos e migration desatualizada. Os catálogos de etapas e simuladores também são confrontados com o registro.
5. Aplicar a migration aprovada no ambiente de destino antes de promover o runtime correspondente, seguindo o coordenador de publicação, backup e proteção contra deploy concorrente. O comando de geração local não escreve em bancos remotos nem autoriza publicação.

Páginas internas de diagnóstico `read-model-v3` têm uma lista explícita de exclusão do catálogo de navegação e continuam protegidas pelos próprios gates. Uma rota nova não deve ser excluída para contornar a validação.

## Comportamento administrativo

- Cada acesso informa as páginas que utilizam sua permissão. A busca por acesso também encontra nomes e rotas dessas páginas.
- O catálogo de páginas tem rolagem contínua, acessível por teclado, sem controles de próxima página. Busca, módulo, status e ações continuam funcionando sobre o catálogo inteiro já carregado.
- A sincronização atualiza os metadados, mas não redefine `is_active` de páginas existentes. Não remove exceções de usuários nem altera os padrões dos demais papéis.
- A navegação usa somente linhas autorizadas e persistidas no banco. Não existe uma lista suplementar que recrie páginas desativadas ou ausentes. Desativação controla a navegação; a autorização da rota e dos dados continua sendo aplicada no servidor e no banco.
- Restrições adicionais, como Repasse exclusivo de Admin/Master e os gates de execução dos simuladores, permanecem obrigatórias.

## Validação do banco

Além dos testes unitários e do ensaio completo de restauração, conferir o catálogo no contrato compacto de produção antes de aplicar. O registro esperado nesta entrega contém 27 páginas, com as dez páginas antes suplementares incorporadas. A mudança usa as permissões existentes; não amplia os dados comerciais acessíveis aos papéis atuais.
