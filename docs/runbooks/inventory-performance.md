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
- Falha de consulta inicia intervalo de cinco segundos por processo antes de
  nova tentativa na origem ou arquivo. Respostas incluem Retry-After, continuam
  autorizadas individualmente e nao prolongam o intervalo. A recuperacao volta
  a compartilhar uma unica tentativa. Leitura do snapshot limita-se a vinte
  segundos; resultado tardio nao pode preencher o cache apos esse prazo.
- Tabelao limita cada consulta a vinte e cinco segundos, valida o payload antes
  de renderizar e mantem cancelamento por pagina. Estoque vivo fica disponivel
  antes do complemento de enderecos; se vazio ou com enderecos completos, nao
  consulta esse complemento. Falha apenas do complemento preserva a lista viva.
- Filtros calculam as facetas numa passagem, preservam contagens e valores exatos.
  A ordenacao e reutilizada entre filtros. Opcoes dos selects sao memoizadas;
  editar a proposta nao recria centenas de opcoes. A janela continua em 60 linhas.
- No Associativo mobile, os cabecalhos crescem com o conteudo. O botao Limpar
  filtros possui alvo de 44 px e nao deve sobrepor o primeiro campo nem os
  metadados do estoque; a matriz autenticada verifica essas colisoes e a altura
  efetiva do botao, inclusive diante das regras compactas herdadas.

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

### Benchmark De Facetas

Medicao em Windows com Node 24.19.0, 3.301 unidades, 20 aquecimentos e 100
amostras por cenario. O script compara os resultados completos com a versao
anterior antes de informar tempos; nao imprime dados do estoque.

| Cenario        | Mediana anterior | Mediana nova |
| -------------- | ---------------: | -----------: |
| Sem filtro     |        12,689 ms |    12,571 ms |
| Regiao         |        57,023 ms |    12,449 ms |
| Empreendimento |         0,936 ms |     0,642 ms |

O ganho de 78% no cenario Regiao mede apenas o helper de facetas, nao o tempo
total de abertura da pagina. A primeira consulta sem cache ainda depende da origem.

```bash
node scripts/qa/inventory-benchmark.mjs <snapshot-privado> <checkout-anterior>
```

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
