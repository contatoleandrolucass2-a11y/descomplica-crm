# Agendamentos — apresentação, metas e visitas

## 2026-11-05 — Abertura: apresentação, metas e visitas de Agendamentos

- Escopo exclusivo /app/etapas/agendamentos, solicitado nos21prints: composição
  estável por tela/zoom e navegação por gráfico centralizado; filtros compactos;
  tilt do card inteiro, resumos e pop-ups centralizados; gatilho somente no
  número da torre; metas diária/semanal/por equipe com dias úteis e quinta2,
  excluindo feriados nacionais e municipais de São Paulo; listagem de todos os
  agendamentos sem visita confirmada e tabelas compactas. Outras páginas fora.
- Git comum confirmado; árvore limpa inicial98d476f0. Fetch/main e health ao
  vivo13:31UTC/10:31BRT e407ecd9d10a10b7a794e4cb9d1b20466eed608e,HTTP200/ok.
  CI main42027654068 concluída/success. Branch nova baseada nesse main.
- Conhecimento e skills pertinentes consultados; notas históricas não validam
  esta entrega. Implementação, gates e prova visual do novo pedido pendentes.
  Autorizações existentes de migrations antigas não abrangem DDL novo.

## Implementação e evidências locais

Fontes alteradas: componentes exclusivos de Agendamentos, análise de metas,
contrato/servidor/controller de detalhes; DashboardShell, DashboardCanvas e
DashboardModal apenas nas dependências de opt-in da página. Demais rotas não
recebem a composição fixa, o guia novo nem a opção de portal no corpo. Nenhuma
alteração de coletor, agendamento, SQL, RPC, permissões ou dados remotos.

A apresentação fixa uma referência lógica de1236px e ajusta a escala à área
visível. O canvas mantém dimensões e ordem salvas; a inclinação passa ao artigo
com sua borda original. Guia mostra um gráfico por vez, começa pelo funil,
centraliza nas duas dimensões e preserva o mesmo nó React/estado. Escape e
Visão geral saem. Novos defaults corrigem o segundo indicador de3para2colunas
e usam194px de altura nos12 indicadores; perfis existentes não são regravados.

Correção de metas: weeklyTarget usava maior produção real, e o diário passava
roster constante em vez de bucket.goal. Agora cada bucket usa calendário e
coorte válidos. Para34corretores em novembro/2026, semana2 vale170 (Finados0,
terça1,quarta1,quinta2,sexta1 por corretor); quinta05/11vale68. Igual à meta
permanece positivo; abaixo fica vermelho. Resultado zero mantém altura zero,
com seu rótulo vermelho quando há déficit comprovado.

Limite da hierarquia regional: cadastro persistido contém corretor/gerente,
sem campo regional canônico para todos. Regional vem do histórico operacional.
Não há campo descartado pelo parse para recuperar. Meta exata permanece null
quando a coorte não é completamente conciliável. goalLowerBound separado soma
somente a coorte comprovada: realizado menor prova déficit; realizado maior
ou igual não prova meta atingida. A UI identifica esse mínimo e não anuncia
valor parcial como meta exata. Não extrapolar vínculos instáveis nem usar só
corretores com atividade como denominador.

Lista: o pedido novo é TODOS sem confirmação, não apenas vencidos. Novo subset
without_visit é aditivo e mantém o legado overdue. Só visitPerformed===true
exclui a linha; data ausente/futura ou attendedAt isolado não são confirmação.
Filtro ocorre sobre a consulta autorizada completa antes de página/CSV.
Controller só deriva do cache-base se completo, mesmo snapshot e mesmos
filtros; nunca filtra50de123como total. Bootstrap17 completo pode fornecer o
subset sem nova requisição tardia. A mensagem antiga indisponível era erro
genérico e não permite afirmar resultado zero ou causa de infraestrutura.

Validações locais reutilizadas, sem somar reexecuções como testes distintos:

- Metas/análise/mensal/ranking:66casos iniciais aprovados. Após adicionar mínimo
  regional, ranking revalidado em6casos (um novo caso de coorte incompleta).
- Detalhes autorizados/controller:25casos aprovados. Cobertura de126linhas sem
  visita, paginação50, CSV integral, filtros, datas ausentes/futuras, null,
  snapshot/cursor e negativa de autorização.
- Interface:70casos em7arquivos, incluindo componentes compartilhados diretamente
  consumidos pela página. ESLint focado aprovado pelos agentes responsáveis.
- Apresentação/navegação:29casos unitários/SSR inicialmente aprovados; browser
  sintético em cinco geometrias, com mesmos nós/estado e sem onCommit.
- Configuração do canvas:6casos aprovados após ajustar defaults.
- TypeScript encontrou três erros apenas nos fixtures novos: tipo scheduledAt
  inferido estreito e filtros possivelmente undefined. Corrigidos sem relaxar
  contrato de produção.16casos desses dois arquivos repetidos e aprovados;
  tsc --noEmit passou após as correções.

Evidências sintéticas locais ignoradas: test-results/appointments-metas/
result-ui-mobile.json e result-ui-desktop-zoom.json; appointments-daily-team-focus/
result-after.json. Usam componentes/CSS reais e dados/transporte sintéticos,
sem requisições externas ou gravação em produção. Desktop1440x1000 com escala
ancestral0.75 e mobile390x844 cobrem resumos, calendário e tooltips centralizados,
hover restrito ao número, foco/toque e tabelas136/84linhas sem horizontal.
Não usar capturas antigas de outro candidato como aprovação desta entrega.

CI completa no SHA candidato e main, imagem aprovada e publicação protegida
continuam obrigatórias. Mudança opt-in no shell mantém o classificador visual
conservador; não reduzir seu escopo nem atualizar referências de outras páginas.
Prova autenticada após publicação deve confirmar apresentação, lista real,
metas/cores, pop-ups, zoom/viewport e preservação de layouts sem gravação de teste.
