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

## CI do PR502 e aviso de indisponibilidade — 05/11/2026

CI42042131572 encontrou uma asserção do título antigo da lista;5077casos
passaram. Alinhada a expectativa para Agendamentos sem visita confirmada;
três casos locais passaram. Novo candidato17e91f87.

CI42042828495 aprovou validate, promotable-image e isolated-restore. Release-gates
aprovou autorização, migrações/testes do banco e verificações funcionais;
matriz final falhou somente por pixel_drift em10capturas de Agendamentos.
Os231quadros de outras páginas permaneceram aprovados; todos os checks de
rota, temas, teclado, zoom e acessibilidade passaram. Artefato13427211953,
ZIP SHA2565caf2cafd4e8d1d98c7fa10a9554c658c622ea7871a72fbfca7fb92ddcaf64e0.
Captura420f6ee0 é o merge sintético, árvore18849aef idêntica ao head17e91f87.
Fingerprint8d98d83f foi reproduzido integralmente: diff vazio e19artefatos
untracked de output/playwright/connected-systems, sem edição de código.

Revisão dos originais mostrou que a escala também reduzia o aviso de dados
indisponíveis, tornando o texto pequeno em celular. Nenhuma referência foi
adotada. Agora a composição exige data-appointments-dashboard montado; o aviso
mantém a largura responsiva e a escala original. Observer acompanha chegada
ou retirada do dashboard sem reescrever perfil. Browser local revalidou cinco
geometrias, navegação, estado, resize lógico e aviso sem escala em390/1440;
segundo browser cobriu navegação em três temas/seis larguras. Ambos passaram;
29testes unitários/SSR passaram. CI completa do novo SHA continua necessária.
As capturas gerais dessa CI são do estado indisponível, não provam os cards
com dados; estes têm cobertura sintética dedicada e exigem prova real no site.

## Publicação visual e conciliação oficial da hierarquia — 05/11/2026

PR502 integrado16:27:34Z em28b4ac35. CI42054435745 (head72e96aa8) e
CI42064655539 (push/main28b4ac35) aprovaram os quatro gates, sem trocar baselines.
Imagem CI13434836159: ZIP68583777c0b577aacdd33e5ab108127aa38f3c0c8e5a3124d70605f88bd840fc;
arquivo411b3de4e4b03d96fd7b2e5d3ad6afc15b636b22ef90dafb164e16e2f6c04a12;
configCI5b7aba4b1e6b4dc7fcd00b343b3ab45aca8a687f520a58959afc9f5c175fd22f;
manifest/locald154cf3fcd262845e179108e9fd0ae1c14c8cf71c15bfa20687a93452dc98144.
Cadeia OCI e14camadas conferidas, sem rebuild/retag; image:prove aprovou os
mesmos dois perfis isolados. Deploy protegido8228d2a6-5ceb-4f13-9263-72f0f1a3644f
às17:19:14.807Z (14:19BRT), anterior57305658/e407ecd9; sem pendência.
Health17:42:06Z confirmou200/ok/28b4ac35; anônimo redireciona307/login.

Chrome e integrado autenticados:32IDs, dimensões e ordem iguais, preservados
após reload e navegação sem gravação. Integrado percorreu20seções com espera
pelo artigo esperado; primeiro clique mostra só o funil. Celular simulado390x844
↔844x390 manteve o mesmo perfil depois de atualizar. Resumo KPI, calendário,
editor e equipe centralizados; editor fechado sem salvar. Tabela geral17linhas;
sem visita confirmada16linhas (inclusive datas futuras), dez colunas, sem overflow
horizontal; todas as linhas montadas. Semana atual:150para30corretores,
17realizados vermelhos; quinta-feira60, realizado0 abaixo. Fontes/prints locais
ignorados: test-results/appointments-apresentacao-live/receipt.json e JPEGs.
Zoom é equivalente CSS/viewport em CI/local, não prova em celular físico nem
controle de zoom nativo. Algumas chamadas CUA perderam a confirmação após
aplicar eventos; estado novo foi conferido antes de prosseguir. Capturas rápidas
antes do paint foram refeitas e não usadas como evidência.

Limite encontrado no aceite: regional Daniel Vilar tem vínculo indisponível no
roster; mínimo regional comprovado não foi promovido a meta total. Perguntado,
o usuário indicou o relatório Agendamentos (coluna Gerente Regional) e Corretores.
Consulta visual oficial em00OTT000009j0l32AA confirmou BASE CORRETORES/30registros,
gerente oficial Account.Comissionado_generico_3**c.Name e Regional Comercial
Account.Regional_Comercial**c=SP CAPITAL, que não é uma pessoa. Nenhum CPF,
contato, banco ou linha privada do relatório foi exportado. Agendamentos já
coleta Activity.Gerente_Regional\_\_c por label validado.

Rastreio somente leitura identificou que ranking.managerName vem da última
atividade e não preserva o gerente oficial já coletado do cadastro; a tabela
não retém uma hierarquia oficial separada. Continuação autorizada pelo pedido:
conciliar o corretor cadastrado ao regional de seus agendamentos e preservar
gerente oficial em campos aditivos exclusivos de leitura por Agendamentos.
Demais páginas e manager_name legado devem ficar iguais. Migration, API e
coletor ainda NÃO alterados remotamente; preparar compatibilidade, pgTAP,
backup/rollback e CI antes de pedir autorização remota específica.

### Continuação — hierarquia oficial preparada (05/11/2026, 18:08 UTC)

Branch codex/agendamentos-vinculo-regional sobre main28b4ac35. Conferência
origin/main sem mudança; publicação anterior continua28b4ac35. Dados aditivos
rosterManagerName/regionalManagerName separados do managerName legado;
Agendamentos lê os novos vínculos sem inferir regional explicitamente null.
Leitura antiga sem os campos mantém compatibilidade nas fixtures/consumidores.
A fonte regional é a observação elegível do próprio corretor, conciliada ao
cadastro oficial; nenhum fallback por gerente para corretor sem observação.

Produtor7/7, ingestão48aprovados/1ignorado, leitura/metas/equipe43 e calendário/
modelo compartilhado26 aprovados localmente. Revisão estática independente sem
vulnerabilidade demonstrada; exige pgTAP e matriz ACL na CI. Migration gerada
pelo CLI2.115.0, sem upgrade; mantém30s, trava, grants e rollback transacional.
Hash integral aplica apenas a requests enriquecidos; legado requestId-only
preservado. Banco/serviço coletor não alterados; autorização remota específica,
CI e ativação controlada permanecem pendentes. Sync de abertura corrigido após
normalizar LF do registro (CRLF ultrapassava limite);16documentos sincronizados.

### Autorização e CI da continuação —05/11/2026,18:18UTC

PR504 preparado emfd0cfa43; CI42081900887 encontrou4falhas no inventário
obrigatório da nova migration (5079testes passaram). Dependências comprovadas
corrigidas:105migrations,50arquivos/2476asserts pgTAP e allowlist de homologação;
34testes focados do controle passaram. Novo candidatoafd0fd14, CI42082726355.

Usuário autorizou especificamente migration20261105175738 e atualização somente
do coletor Salesforce, condicionadas aos quatro gates do PR/main verdes. Inclui
backup/CAS, preservar layouts/permissões e duas cargas completas conciliadas;
rollback mantém os novos campos. Esta aprovação não autoriza apagar locks,
alterar outros serviços, relatórios Salesforce salvos ou contornar gates.
Helper local de migration33guards e helper de coletor/self-test preparados;
nenhuma ação remota de escrita executada. Observação18:13UTC: coletor ativo5da46964,
MemoryMax1610612736, sem daemon-reload pendente. RPC pública atual mantém ACL
postgres/service_role, body48bcdeb5...,timeout30s e definição4d61face....

Revisão final14f7f2a3: gerente oficial explicitamente null torna roster
indisponível, sem substituir por gerente de atividade antiga. DTO legado sem
campo preservado;26 testes do leitor passaram. CIafd0fd14 havia passado validate
e iniciado3gates isolados; o novo candidato repetirá gates obrigatórios.

CI42083827635/3950800d: validate e promotable-image passaram. Jobisolated-restore
127447624635 identificou falha de fixture pgTAP: has_column3args interpretava
schema como tabela; replaylegado goalsAvailablefalse com metasnãozero era
inválido antes de alcançar replay. Corrigidos4args e payloads de replayválidos
com metaszero;31asserts preservados, inclusive ACL/hash/rollback. Migration
permanece byte-idêntica à aprovada. Gates remanescentes desse candidato foram
cancelados pelo coordenador após falha confirmada, sem cancelar outra entrega.

### Base concorrente —05/11/2026,18:55UTC

Consulta origin/main confirmou318b51fa, PR503 de outra demanda. Diff restrito à
CAIXA e seus registros/referências; AGENTS/skills não mudaram. Health público
continua200/ok/28b4ac35 às18:55:15UTC. PR504 tornou-seCONFLICTING somente em
WORKLOG/CHANGELOG. Merge da base na branch preservou integralmente os dois
registros, sem editar código ou referência da outra área. Não se publicou318b.

CI42086063374/33007320 aprovou validate, promotable-image e isolated-restore
(31novosasserts;2476total). Gate de release avançou ao banco isolado. A mudança
de base exige novo candidato/CI antes de integrar Agendamentos; nenhum gate
falho foi ignorado e nenhuma entrega alheia foi cancelada.
