# Agendamentos: resultado e bloqueio de publicação — 04/11/2026

## Estado observado

Fonte: Git/GitHub e health público, conferidos em04/11/2026 às16:14 UTC.
Git comum confirmado. Main1356b4b583f89eb8b83446f0571d62d8ef8a2689;
PR490 aberto, branch codex/agendamentos-trimestre-atualizacao,
candidato2bb866f4899d8be3b18763037b4caa0fc2c71160. Health200/ok,
versão publicada c97d5fd212d2bd62bd4bd435f19d96d0e9b2bc6f, sem novo deploy.

## Entrega implementada, ainda não publicada

Dias da semana com três letras nos eixos de barras/linhas; quarta série com
média diária arredondada para cima do trimestre calendário anterior completo;
meta mensal por corretor em dias úteis, quinta valendo dois, multiplicada pelo
elenco cadastrado filtrado. Feriados nacionais, municipais da capital paulista
e9deJulho têm meta zero, inclusive quando caem na quinta-feira. Pontos
facultativos não são tratados como feriados. Referência oficial:
https://prefeitura.sp.gov.br/web/gestao/w/calendario_2026.

Detalhe diário apresenta equipe com/sem agendamento e nomes abreviados,
com rolagem, teclado e toque; consulta atual da rota Equipe Produtiva renovada
a cada30min, com recuperação ao voltar para a aba. Comparações preservam filtros.
Gauge/funil comerciais configurados não foram reescritos. Sem migration,
permissões novas, alteração n8n ou alteração do relatório salvo no Salesforce.

Evidência local: calendário/análise58/58; comparativos57/57; equipes33/33;
refresh3/3; projeção SSR4/4; coleta/scheduler41/41; escopo visual/SSR49/49;
matriz sintética9/9 em três temas e1440x1000,390x844,844x390;
regressão de foco teclado/toque2/2. Tipos, lint e formatação aprovados.
As capturas locais usam dados sintéticos, não comprovam publicação ou telefone físico.

## Gate bloqueado fora do escopo

CI41853820787 do PR490: validate, promotable-image e isolated-restore aprovados.
Autorização/E2E aprovados. Matriz completa terminou com falha às16:03:13 UTC:
11comparações de `/app` com dimensions_changed, altura exatamente10px menor
(1440px:2509→2499;390px:9999→9989;320px:10072→10062).
154checks de rota,88de tema,242de acessibilidade e verificações funcionais,
zoom e Equipe Produtiva passaram. Job de release ainda em encerramento na
consulta16:14; essa etapa falha já bloqueia promoção, independentemente do encerramento.

Artefato13340183706, captura b741e2aa0108226f3c53a88ec3c9784e7bdfbc1c;
SHA256doZIP262384d7f72dbd37951420eb6163aa3b7797aa0dc9ce6cde7ba06510a0dedf41
verificado. Arquivos locais ignorados: test-results/agendamentos-490-ci-final/
candidate-results.json, failure-summary.json e dashboard-1440x900.webp.

Revisão delimitada não encontrou dependência comprovada: nenhum diff em CSS
global, shell, layout protegido, DashboardReport/analytics ou lib/crm/dashboard;
`/app` usa analisador e componentes próprios. Estilos novos são módulos locais.
Não investigar/corrigir outra página nem atualizar seu baseline neste pedido.
Causa interna dos10px permanece não diagnosticada além dessa delimitação.

## Coleta e navegadores

Trava residual de01/11 após OOM foi recuperada com backup/CAS e prova de processo
inexistente. Última publicação comercial preservada. Serviço antigo322a4166
ativo, PID1738980, sem reinícios na consulta15:40:20 UTC. Dois ciclos automáticos
completos distintos:15:06comercial201+estoque3501;15:36comercial201+estoque3500.
Esses resultados comprovam agenda recuperada, não validam retry novo.

Falha intermitente adicional comprovada por contagens: root20645 e folhas20646
após entrada durante coleta. Correção no PR permite uma única nova geração
completa, dentro do mesmo prazo, mantendo rejeição da segunda divergência.
Não foi aplicada ao serviço. Helper operacional local preparado e testado,
mas condicionado a main/CI exatos e aplicação já publicada; não executado.

Chrome e integrado autenticados em Agendamentos:32cards com IDs, ordem,
largura e altura idênticos à abertura. Nenhuma gravação de perfil nesta rodada.
Comparação pós-publicação, dois ciclos do coletor novo e prints finais da versão
nova no Chrome/integrado/celular simulado não executados por gate bloqueado.
Não repetir logout nem pedir novo login sem uma necessidade observada.

## Critério de retomada e limites

Resolver o bloqueio de `/app` em demanda própria, conforme AGENTS.md; então
reavaliar PR490 contra main atual, CI exata e impacto completo. Somente depois
integrar, aguardar CI main, provar artefato e publicar pelo coordenador com
consulta no minuto, locks, backup, rollback e CAS. Atualizar coletor protegido,
confirmar dois ciclos completos e finalizar testes/prints reais dos fluxos afetados.
Este registro não autoriza mudanças fora do escopo nem dispensa gates.
Publicação deste registro documental não exige reiniciar o CRM.

Fontes: https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/490,
https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/41853820787,
https://crm.descomplicapro.com.br/api/health e evidências locais indicadas.
