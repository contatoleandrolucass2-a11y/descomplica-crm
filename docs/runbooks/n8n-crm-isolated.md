# N8n exclusivo do CRM

## Coleta unica em 12/10/2026

Executada entre 23:14:21 e 23:20:21 Brasilia no release Salesforce
1a949982071ea0f62b094051668bfdb3f24b18b6, com publisher explicitamente false.
Contagens: oportunidades 19965, agendamentos 1091, visitas 514, pastas 2603,
vendas 766, corretores 36 e contas Canal Imob 7. O arquivo candidato ficou
somente na VPS, privado 600, com 46592 bytes; schema Zod do release aprovado
sem issues, 15 metricas e 144 registros de ranking. Lock liberado normalmente.
Nenhuma fonte bruta ou segredo entrou no Git. Nenhum dado foi enviado ao n8n
ou Supabase. Os gates de primeira escrita do runbook de migracao continuam
obrigatorios; esta evidencia nao habilita a agenda automaticamente.

## Evidencia HTTP em 12/10/2026, 23:11 Brasilia

Teste isolado autorizado, com fixture inteiramente sintetica, executado da VPS
para o webhook candidato HTTPS: sem Authorization retornou 403; token incorreto
retornou 403; token privado salvo retornou 202 e corpo com ok false e status
candidate_validated_not_published. Isso nao equivale a publicacao de dados no CRM.

Workflow L90AYSBEat4vYHLz foi despublicado via MCP imediatamente apos o teste.
Releitura confirmou active false, activeVersionId null e persistencia none/false.
Token mantido em arquivo privado root 600 na VPS; nunca versionar seu conteudo.
Nenhuma agenda, coleta Salesforce, escrita Supabase ou mudanca no n8n antigo.

## Limite desta etapa

Instancia nova, sem importar, modificar ou apagar o n8n anterior. A autorizacao
do usuario em 12/10/2026 inclui o novo nome n8n-crm.descomplicapro.com.br e HTTPS.
Nao inclui substituir a conexao MCP anterior, credenciais ou volumes existentes.
Workflows continuam exclusivamente por MCP. Em 12/10/2026, o operador autorizou
validate_workflow (nome exposto pelo MCP atual) antes de update_workflow,
substituindo validate_workflow_code, com releitura depois. MCP indisponivel bloqueia essa etapa;
nao usar REST, importacao CLI ou banco como contorno.

## Candidata Salesforce verificada em 12/10/2026

- Workflow: https://n8n-crm.descomplicapro.com.br/workflow/L90AYSBEat4vYHLz.
- Fonte: ops/n8n/salesforce-candidate.sdk.js; settings complementares em
  ops/n8n/salesforce-candidate.settings.json, aplicados por setWorkflowSettings.
- Criacao e atualizacao feitas por MCP, com validacao e releitura. Active false,
  activeVersionId null. Sem agenda, exportacao ou escrita no Supabase.
- Webhook exige headerAuth; credencial CRM VPS - Snapshot entrada, ID
  VtBqo7sf3XOwxzpr, vinculada via MCP e relida em 12/10/2026. Nao publicar
  nem enviar dados reais enquanto os testes e os demais gates estiverem pendentes.
- Resposta 202 com ok false identifica somente a candidata; nao e recibo de ingestao.
- Armazenamento de execucoes desativado para sucesso, erro, manual e progresso;
  timeout de 600 segundos e timezone America/Sao_Paulo confirmados por releitura.
- OAuth renovado com execucao e leitura de metadados de credenciais autorizadas.
  Execucao manual MCP 2 aprovada em 12/10/2026, 22:57 Brasilia: fixture aceita
  pelo validador e ultimo node success. Registro habilitado temporariamente
  com autorizacao e restaurado para none/false apos o teste, com releitura.
  Fixture sem header secreto nao verifica autenticacao HTTP, resposta de rede
  ou integracao ponta a ponta. Fluxo continua inativo; evidencia sintetica mantida.
- Antes de ativar: teste da credencial, contrato completo e teste ponta a ponta
  com dados sinteticos, mais destino externo autorizado de backup. Backup de Nginx
  nao substitui backup do PostgreSQL e da chave de criptografia.

Teste local: node --test ops/n8n/salesforce-candidate.node-test.mjs
ops/salesforce/n8n-candidate.node-test.mjs. O primeiro usa builders de captura
para comparar o SDK com o validador baseline, sem instalar SDK nem acessar rede.

## Separacao

- Projeto Compose: descomplica-n8n-crm; diretorio /srv/descomplica-n8n.
- N8n, PostgreSQL e runner externo dedicados; sem banco ou volumes do CRM.
- Imagens oficiais fixadas por digest, n8n e runner na mesma versao.
- Porta 5678 somente em 127.0.0.1; banco e broker sem portas publicadas.
- Sem Docker socket, host networking, container privilegiado ou perfil Salesforce.
- Segredos aleatorios locais em arquivo root-only; nunca imprimir Compose expandido.
- Nao usar docker system prune, volume prune, down -v ou comandos globais.

O preparador recusa recursos preexistentes. Falha parcial exige inspecao manual;
nao apagar o diretorio para conseguir repetir. A chave de criptografia precisa
ser preservada junto com o banco para recuperar credenciais no futuro.

## Acesso inicial

Manter privado ate o operador criar a conta proprietaria. Usar um tunel SSH
com bind local, sem escutar na rede do computador:

```powershell
ssh -N -L 127.0.0.1:5678:127.0.0.1:5678 descomplica-crm-vps
```

Abrir http://localhost:5678. O operador preenche a senha diretamente na tela,
sem envia-la pelo chat. Nao desativar cookies seguros nem o cadastro de usuarios.
Depois, configurar DNS A somente de n8n-crm para a VPS, verificar resolucao,
emitir certificado e preparar um virtual host Nginx exclusivo. Nao expor a
tela inicial de cadastro sem proprietario na internet. Nao reutilizar cookies,
tokens, credenciais ou dados privados da instancia antiga.

## Validacao e recuperacao

### Backup local da nova instancia

ops/n8n/backup-local.sh exige root, diretorio 0700, .env 0600, nomes/labels
e volume exatos do projeto novo. Faz lock, pausa brevemente apenas o novo n8n,
captura pg_dump, configuracao privada e volume .n8n, e libera a aplicacao com
trap de recuperacao. Nao imprime segredos nem envia arquivos para fora da VPS.
Nao executar durante coleta ativa ou alteracoes administrativas concorrentes.

Cria diretorio exclusivo em /srv/descomplica-n8n/backups, sem sobrescrever ou
remover copias. Verifica hashes e restaura o banco em PostgreSQL temporario
sem rede, portas ou volume persistente, usando a mesma imagem local do banco.
O container temporario e removido ao final, inclusive em falha. Artefatos
incompletos ficam preservados para diagnostico; ausencia de verification.txt
impede considerar a copia validada. Script nao configura agenda nem retencao.

Em 12/10/2026, 22:25 Brasilia: backup local-20261013T012505Z-dSchqd passou,
148 tabelas restauradas, arquivos 0600/root e pasta 0700/root, checksums validos,
readiness ok depois. Nome usa UTC. Nao testou boot de aplicacao restaurada ou
descriptografia de credenciais. Copia no mesmo disco NAO e backup externo.
Destino externo continua dependendo de autorizacao; nenhuma copia saiu da VPS.

Antes de iniciar: validar Compose com --quiet, recursos livres, digests,
limites e ausencia de nomes/volumes preexistentes. Conferir healthz e
healthz/readiness locais, versao, estado do runner e bind somente loopback.
Comparar health/versao do CRM e atividade do browser/monitor Salesforce antes
e depois. Nunca executar build ou suite pesada na VPS compartilhada.

Rollback inicial: parar somente os servicos do projeto descomplica-n8n-crm,
preservando volumes e .env. Nao remover dados automaticamente. Antes de qualquer
upgrade posterior, fazer pg_dump consistente do banco dedicado e copia privada
da chave/configuracao e do volume .n8n; conferir checksum e restaurar em ambiente
isolado. Backup local no mesmo disco nao protege contra perda da VPS. Definir
destino externo autorizado antes de carregar dados comerciais nesta instancia.

## Proxima etapa

### MCP OAuth confirmado

Entrada local n8n_crm_vps separada, endpoint HTTPS /mcp-server/http. OAuth
concluido e cliente Codex visivel no n8n com leitura/escrita de workflows,
leitura de execucoes/projetos/tags; sem execucao de fluxos nesta etapa.
Se ferramentas nao aparecerem no chat, recarregar cliente/sessao e conferir
inventario. Nao substituir MCP antigo, gerar token ou contornar por REST.
Antes de qualquer update_workflow, executar validate_workflow (substituicao
nominal autorizada pelo operador em 12/10/2026) e reler
depois. Autenticacao sozinha nao comprova validacao ou ativacao de automacoes.

### Liberado apos cadastro do owner

Operador confirmou cadastro e navegador mostrou painel autenticado. Aplicados
compose.https.yaml e nginx.conf. Usar sempre os dois arquivos Compose nas
operacoes seguintes: `docker compose -f compose.yaml -f compose.https.yaml`.
Somente n8n foi recriado; volumes, banco, runner e chave foram preservados.
Proxy encaminha ao loopback, sobrescreve forwarded headers e aceita WebSocket.
Painel200, API sem sessao401 e endpoint owner/setup403 confirmados. Login publico
HTTPS observado; sessao localhost nao e transferida para o dominio novo.
Rollback: restaurar nginx-pending-backup.conf e validar/recarregar Nginx antes
de voltar ao Compose privado; preservar dados e .env. Sem workflow ativado.
MCP e backup/restore continuam pendentes. WEBHOOK_URL legado mantido com mesmo
valor de N8N_WEBHOOK_URL para compatibilidade, conforme documentacao oficial.

### Estado em 12/10/2026, 21:32 Brasilia

DNS A novo e certificado dedicados aplicados. Nginx usa nginx-pending.conf:
HTTP redireciona ao HTTPS; HTTPS retorna503, sem proxy para o cadastro inicial.
Certificado vence em 10/01/2027; certbot.timer ativo e hook existente de reload.
Backup privado de configuracao em /srv/descomplica-n8n/nginx-before-https-20261013.tar.gz.
Esse backup nao e backup dos dados n8n. Validacao nginx -t e HTTPS externo
confirmados; CRM continua ok em9ff3fd3 e servicos Salesforce ativos.

Antes de liberar: operador conclui owner pelo tunel; confirmar tela autenticada,
configurar URLs HTTPS e N8N_PROXY_HOPS para o proxy unico, validar Compose,
recriar somente novo n8n e aplicar vhost proxy revisado. Nao substituir503
sem owner confirmado. MCP, backup/restore e automacoes permanecem pendentes.

Depois de conta, HTTPS e MCP validado, criar fluxos inativos exclusivos do CRM.
Nao ativar agenda antes de conciliar os sete relatórios e o recibo final da
publicacao. Seguir [contrato Salesforce](salesforce-n8n-migration.md). Conexao
Salesforce, instancia n8n instalada e Supabase atualizado sao estados distintos.

## Fontes

- [Instalacao oficial](https://docs.n8n.io/hosting/installation/docker/).
- [Backup e restauracao](https://github.com/n8n-io/n8n-docs/blob/main/docs/deploy/host-n8n/keep-n8n-running/backup-and-restore.md).
- [Runner externo](https://docs.n8n.io/hosting/configuration/task-runners/).
- [Release 2.42.7](https://github.com/n8n-io/n8n/releases/tag/n8n%402.42.7).
