# Coletor Salesforce na VPS

O servico `descomplica-salesforce-collector.service` executa a coleta existente
e o monitor no mesmo processo. Substitui somente o monitor independente;
nao reinicia navegador, gateway, CRM ou n8n. O n8n antigo fica fora do escopo.

## Contrato operacional

- Primeiro ciclo imediato; seguintes nas fronteiras de 30 minutos. Se uma
  coleta atravessar uma fronteira, aguarda a proxima, sem sobreposicao.
- Lock exclusivo pelo caminho do candidato, limite de coleta de 25 minutos,
  cancelamento cooperativo e publicacao comercial somente apos os sete relatorios.
  O ESTOQUE SPC é coletado e publicado em seguida, com limite adicional de cinco
  minutos, antes de agendar o próximo ciclo. Ver [estoque automático](salesforce-inventory.md).
- Arquivo candidato privado e substituido atomicamente. Falha de coleta nao
  substitui o candidato anterior; falha de publicacao nao apaga o banco.
- Novo n8n recebe somente o snapshot normalizado. O CRM valida e chama a RPC
  atomica existente. O coletor confirma HTTP 200/201 e o mesmo requestId.
- Monitor consulta a sessao a cada 45 segundos e envia contagens, horario de
  coleta, publicacao e proxima execucao. Recibo de conexao vence em 120 segundos.
- Credenciais entram pelo `LoadCredential` do systemd, sem valores em unidade,
  argumentos ou logs. `ExecStartPre` copia somente as duas credenciais para
  `RuntimeDirectory` privado (0700), com arquivos 0600 do usuario dedicado.
  Isso preserva a validacao estrita do coletor: no systemd255 a origem montada
  pode aparecer como 0440/root com ACL. As copias ficam em `/run` e sao
  removidas pelo systemd ao parar o servico. Destinos sao fixos; nenhum listener
  novo e aberto. Nao afrouxar a validacao dos arquivos privados.
- `Conflicts` impede o monitor independente e o coletor de rodarem juntos.
  A ativacao desabilita o monitor antigo tambem no boot, com rollback registrado.

## Antes de ativar

Exige autorizacao para agenda e ingestao real, conexao Salesforce validada,
primeira carga reconciliada no Supabase e backups privados ja conferidos.
Nao confundir permissao para preparar o servico com evidencia de ativacao.

1. Validar lint, typecheck, test, build e quatro jobs CI no SHA exato de main.
2. Preparar checkout limpo/root-owned em `/srv/descomplica-crm-releases/<SHA>`.
   Node 24.19.x e pnpm 11.20.x, lockfile congelado. Dependencias devem ser
   legiveis pelo usuario dedicado; nunca alterar permissoes do cache pnpm
   compartilhado nem de arquivos com hardlinks para fora do checkout.
3. Conferir navegador ativo, monitor antigo ativo/habilitado, coletor ausente,
   candidato/segredos privados e ausencia de export em andamento.
4. Preparar unidade e registro privado de reversao sem iniciar servicos.
5. Ativar somente depois de conferir que release, CI e estado nao mudaram.
   Nao usar `EnvironmentFile=monitor.env`: ele desabilita a publicacao.

O instalador e exclusivo da primeira ativacao. Atualizacao posterior exige
revisao especifica; nao remover registro ou unidade para simular instalacao nova.

Com SHA completo e ID da CI de main ja conferidos, executar como root na VPS:

```bash
/usr/local/bin/node /srv/descomplica-crm-releases/$SHA/ops/salesforce/vps/install-collector.mjs prepare "$SHA" "$CI_RUN_ID"
/usr/local/bin/node /srv/descomplica-crm-releases/$SHA/ops/salesforce/vps/install-collector.mjs activate "$SHA"
```

`prepare` consulta GitHub, verifica codigo e captura o estado anterior; nao
inicia nem para servicos. `activate` repete verificacoes, confirma dependencias
como usuario dedicado, valida a unidade e troca o monitor pelo coletor.
Confirma tambem a estabilidade inicial do processo; isso nao substitui os
dois ciclos reais de aceite.
O registro em `/var/lib/descomplica-salesforce-collector-install/state.json`
fica root-only, protegido por lock e comparacao integral antes de escrita.

## Aceite em producao

### Atualizacao aditiva do dashboard

Autorizacao especifica recebida em15/10/2026 para preservar dimensoes dos
relatorios e habilitar filtros/metas. Nao usar o instalador de primeira
ativacao para atualizar uma unidade existente, nem apagar seu ledger.

1. Exigir CI completa do main exato, migration revisada aplicada, CRM compativel
   publicado e location Salesforce8m validada. Checkout imutavel no caminho
   aprovado, Node24.19.x e dependencias legiveis pelo usuario dedicado.
2. Sob `installation.lock` existente, guardar em diretorio novo root-only a
   unidade, conjunto completo de drop-ins e ledger original, com hashes e
   estado efetivo. Registrar a atualizacao separadamente, sem alterar o ledger
   da primeira instalacao. Conferir CAS de todos os arquivos antes da troca.
3. Aguardar fim do ciclo, inclusive estoque. Parar somente o coletor e exigir
   MainPID0, cgroup vazio e ausencia de export ativo. Timeout, encerramento
   forcado ou lock remanescente bloqueiam; nao limpar locks automaticamente.
4. Conferir novamente CAS e instalar atomicamente apenas o drop-in aprovado:
   WorkingDirectory da release exata e
   `Environment=SALESFORCE_DASHBOARD_ANALYSIS_ENABLED=true`. Preservar usuario,
   sandbox, ExecStart, credenciais, destinos e agenda. Drop-in preexistente
   desconhecido ou override concorrente bloqueiam.
5. Executar systemd-analyze verify, daemon-reload e conferir configuracao
   efetiva privadamente, sem imprimir segredos. Iniciar somente o coletor,
   verificar PID estavel, cwd/flag e manter navegador/monitor no estado anterior.
6. Exigir os dois ciclos distintos e conciliacao descritos abaixo. Uma unidade
   ativa nao comprova ingestao. Workflow n8n preserva o payload integral;
   configuracao efetiva e recibo final devem ser confirmados, nao presumidos.

Recuperacao: sob a mesma trava e CAS, parar apenas o coletor, confirmar termino,
restaurar somente o drop-in anterior (ou remover o arquivo criado pela propria
transacao), daemon-reload e iniciar a release anterior. Nao restaurar candidato
antigo, ledger, credenciais ou snapshots. Publicacao ambigua exige conciliacao
por requestId antes de nova tentativa. Manter backup e registro da tentativa.

### Evidencias obrigatorias

- Coletor `enabled/active`, usuario dedicado; monitor independente
  `disabled/inactive`. Navegador e demais servicos permanecem ativos.
- Dois ciclos reais distintos: requestId, referencia, contagens de origem,
  recibo de publicacao e uma run/auditoria por carga no Supabase.
- Snapshot gerado avanca; replay do mesmo requestId nao duplica dados.
- CRM mostra evidencia recente do monitor e da ingestao, sem afirmar que
  um servico esta conectado apenas porque a URL abre.
- Conferir ausencia de execucoes sobrepostas e de payloads salvos no n8n.
- Registrar hora em America/Sao_Paulo, SHA do coletor, versao do CRM separada,
  CI, estado anterior, recibos e caminho privado de rollback, sem segredos.

## Falhas e reversao

Falha de coleta/publicacao marca o ciclo como falho e preserva o ultimo
snapshot valido no banco. A rotina tenta novamente na proxima fronteira.
Um SIGTERM cancela e aguarda limpeza; encerramento forcado pode deixar lock.
Nao remover lock sem confirmar que o processo terminou e nao ha export ativo.

A reversao desabilita/para somente o coletor e restaura o estado anterior do
monitor. Nao remove candidato, perfil, credenciais, workflow ou dados Supabase.
Falha intermediaria deve permanecer registrada e recuperavel, nunca tratada
como ativacao concluida. Conservar backup e registro privado para inspecao.

Para reverter a mesma instalacao, usar o SHA registrado, mesmo se main avancou:

```bash
/usr/local/bin/node /srv/descomplica-crm-releases/$SHA/ops/salesforce/vps/install-collector.mjs rollback "$SHA"
```

Confirmar monitor no estado anterior e coletor ausente; reexecutar rollback e
seguro quando a reversao anterior ja terminou e nenhum estado externo mudou.
Uma unidade parada pode ser descarregada pelo systemd antes de `reset-failed`;
nesse caso, confirmar estado inativo/desabilitado em vez de tratar ausencia
de estado de falha como falha de reversao.

MFA, revogacao e expiracao de sessao continuam sob controle do Salesforce.
Quando exigida, autenticar pelo console remoto no CRM; nao copiar cookies do
PC nem desativar MFA. Reiniciar o coletor zera progresso em memoria ate nova
coleta, mas nao apaga snapshots ja publicados. Sem destino de alertas aprovado,
a evidencia de falha permanece no CRM e nos logs operacionais sem payload.

## Fontes

- [systemd 255: credenciais e ambiente](https://github.com/systemd/systemd/blob/v255/man/systemd.exec.xml).
- [Sessao da VPS](salesforce-vps-session.md).
- [Ingestao e contrato n8n](salesforce-n8n-migration.md).
- [Conclusao e backups](conclusao-salesforce-n8n.md).
