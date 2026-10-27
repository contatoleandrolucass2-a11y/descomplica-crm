# Canvas analítico configurável

## Escopo

O canvas é usado exclusivamente em:

- `crm.dashboard` (`/app`);
- `crm.stage.appointments` (`/app/etapas/agendamentos`).

Ele reorganiza as visualizações existentes sem alterar as fontes, fórmulas,
permissões ou filtros globais das páginas. Cada card é serializado com métrica,
modelo, período compatível, agrupamento, entidades, posição, largura, altura e
opções visuais. A versão atual do documento é `schemaVersion = 2`.

## Interação

- A grade usa 12 colunas em desktop e se adapta a tablet e celular.
- Arrastar usa Pointer Events, captura de ponteiro, placeholder, snap e reflow.
- Redimensionar respeita os limites mínimos por tipo e nunca sobrepõe cards.
- Teclado: o manipulador move o card; o canto de redimensionamento altera
  largura/altura; `Esc` cancela a interação ativa.
- A seleção múltipla move um conjunto preservando sua ordem interna.
- Desfazer e refazer cobrem adicionar, editar, remover, mover e redimensionar.
- O editor só oferece combinações que a página consegue calcular com seus dados
  atuais. Não são mostrados filtros ou modelos sem efeito real.

## Perfis e concorrência

Os perfis são privados por usuário, página e escopo. A migration
`20261026194815_dashboard_profiles.sql` cria a tabela e RPCs versionadas. O
cliente não possui acesso direto à tabela: leitura e escrita passam pelas rotas
`/api/dashboard-profiles`, com sessão, permissão da página, MFA, catálogo de
campos e limites de payload validados no servidor.

O salvamento automático aguarda 700 ms. Cada atualização envia a versão lida;
uma versão divergente retorna `409` e exige recarregar a cópia remota. O cache
local serve somente como contingência de leitura quando o servidor falha e não
substitui o perfil oficial.

## Exportação

O usuário seleciona os cards e o PDF mantém a ordem atual, contexto, filtros,
fonte e horário. Além do resumo textual acessível, cada card selecionado é
capturado no navegador como imagem PNG e incluído no PDF. Cards não selecionados
não aparecem.

## Migração e rollback

Esta entrega não autoriza aplicar a migration nem publicar em produção. Quando
houver autorização específica, execute os gates do projeto e a publicação
protegida. Para rollback de interface, reverta a integração do componente
`ConfigurableDashboardCanvas`; os dados dos perfis podem permanecer sem afetar
as páginas antigas. Qualquer remoção da tabela ou dos perfis é destrutiva e
exige autorização própria.

## Validação mínima

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`
4. `pnpm build`
5. conferir as duas páginas em desktop, tablet e celular nos temas claro, médio
   e escuro;
6. mover e redimensionar cards, testar `Esc`, teclado, desfazer/refazer, perfis,
   conflito de versão, expansão e PDF seletivo;
7. executar pgTAP depois de aplicar a migration em ambiente autorizado.
