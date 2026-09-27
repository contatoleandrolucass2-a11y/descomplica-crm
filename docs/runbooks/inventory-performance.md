# Desempenho do estoque

## Funcionamento

- Associativo e Investidor consultam snapshot e fonte viva simultaneamente.
  A fonte viva aguarda a tentativa do snapshot para preservar o enriquecimento
  comercial. O snapshot fica utilizavel assim que chega. Falhas independentes
  permitem a fonte disponivel; a Tabela Direta aceita exclusivamente o snapshot.
- Navegar para outra pagina cancela as consultas. Cada consulta do cliente tem
  limite de 25 segundos; a origem no servidor tem limite de 20 segundos.
- `GET /api/inventory` guarda somente o ultimo JSON validado em memoria por
  30 segundos. Requisicoes simultaneas compartilham a mesma consulta a origem.
  O cache e por processo; reiniciar a aplicacao o descarta. Nao contem sessao,
  cookie, permissao ou dados pessoais do usuario.
- A autorizacao `crm.simulators.view` ocorre antes de qualquer acesso ao cache.
  O JSON da origem e o mesmo para todos os usuarios autorizados. Se esse contrato
  mudar para estoque por organizacao, o cache devera ser particionado ou removido.
- Respostas mantem `Cache-Control: no-store`; nao existe cache publico, persistencia
  no navegador nem retorno de entrada vencida quando a origem falha.
- Filtros calculam as facetas numa passagem, preservam contagens e valores exatos.
  A ordenacao e reutilizada entre filtros. Opcoes dos selects sao memoizadas;
  editar a proposta nao recria centenas de opcoes. A janela continua em 60 linhas.
- No Associativo mobile, os cabecalhos crescem com o conteudo. O botao Limpar
  filtros possui alvo de 44 px e nao deve sobrepor o primeiro campo nem os
  metadados do estoque; a matriz autenticada verifica essas colisoes.

## Medicao

Inspecionar a requisicao autenticada `/api/inventory` no navegador:

- `Server-Timing: auth;dur=..., inventory;dur=...`: milissegundos de autorizacao
  e leitura do estoque no servidor. Rede e desenho da pagina sao medidos a parte.
- `X-Inventory-Cache: MISS`: consultou a origem.
- `X-Inventory-Cache: COALESCED`: aguardou uma consulta ja em andamento.
- `X-Inventory-Cache: HIT`: reutilizou a resposta validada ainda dentro do prazo.
- `X-Inventory-Cache-Age`: idade em segundos desde a consulta bem-sucedida.

A data `generatedAt` continua sendo a data informada pela origem, e nao a hora
da consulta. Cache rapido nao significa estoque atualizado na origem.

## Ferramentas E Uso

- `investigate-first`: localizar a causa da demora antes de editar.
- `vercel-react-best-practices`: otimizar consultas, estado e renderizacao React/Next.
- `web-design-guidelines`: revisar legibilidade, carregamento, foco e acessibilidade.
- `playwright`: conferir filtros, selecao, erros, carregamento e telas responsivas.
- `surgical-patch`: corrigir um defeito localizado com escopo pequeno.
- `safe-refactor`: separar componentes preservando comportamento, quando necessario.
- Figma: projetar alteracoes visuais maiores antes de implementa-las.
- Datadog: consultar latencia e erros quando o CRM enviar telemetria para a conta.
- PostHog: analisar jornadas quando houver conta conectada e coleta configurada.
- Supabase: investigar banco, RPC e RLS quando a origem do problema estiver ali.
- GitHub: revisar alteracoes e acompanhar CI/PR.
- Linear: organizar futuras melhorias quando houver necessidade de acompanhamento.

Em 27/09/2026, Figma, Datadog, PostHog, Supabase e Linear constavam instalados.
O PostHog retornou `USER_NOT_LOGGED_IN`. A conexao nao e necessaria para estas
otimizacoes. Instalar o plugin nao configura automaticamente coleta no CRM.
As skills acima ja estavam disponiveis; nenhum SDK de rastreamento foi adicionado.

## Validacao E Reversao

Executar `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build`.
Os testes de estoque cobrem TTL, concorrencia, autorizacao com cache aquecido,
payload invalido, falha apos expiracao, cancelamento, fontes em paralelo,
preservacao da proposta e contagens de filtros. Conferir em navegador autenticado
desktop/mobile e comparar cache frio/quente separadamente.

Reverter a versao da aplicacao remove o cache e restaura a sequencia anterior.
Nao ha migration, alteracao de workflow n8n ou nova dependencia de runtime.
