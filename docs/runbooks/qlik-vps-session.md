# Sessao Qlik na VPS

## Escopo e estado

O fluxo solicitado e Qlik -> VPS -> ranking do CRM. Este componente prepara
somente a autenticacao na origem: nao coleta relatorios, nao grava no Supabase,
nao altera n8n e nao habilita pontuacao. A origem observada e o aplicativo
`00171c17-48de-4488-b1f9-dd6dcb0249e2` (22.1 - Visao House) no tenant
`https://direcional.us.qlikcloud.com/`. Seus titulos de pastas nao comprovam
sozinhos o contrato dos dados. Esta foi a origem inspecionada antes da troca
de escopo. A referencia vigente e Canal de Parcerias, com destino confirmado
`/app/ranking` e candidato 23.1/Vendas. Recorte e evidencias atuais em
`qlik-partnerships-mapping.md`; nao usar o escopo historico abaixo na coleta.

A conta observada possui login por usuario/senha. Autenticar diretamente no
Qlik exibido pelo console e concluir MFA quando solicitada. Nao pedir senha
pelo chat, extrair senhas do perfil pessoal ou copiar cookies do computador.
O perfil privado da VPS conserva a sessao; isso nao impede sua expiracao nem
dispensa MFA. Em pedido posterior, o usuario autorizou guardar tambem usuario
e senha na VPS. O cofre opcional abaixo e separado da sessao e da aplicacao CRM.

## Isolamento

- Usuario tecnico `descomplica-qlik`, sem shell, sudo ou Docker.
- Perfil `/var/lib/descomplica-qlik/chrome`, em diretorio 0700.
- Chrome oficial com sandbox; Xvfb autenticado no display :98, sem X11 TCP.
- Controle do Chrome por pipe privado do processo Playwright; nenhuma porta
  CDP TCP ou encaminhamento de depuracao para o computador.
- VNC e console HTTP/WebSocket em sockets Unix no runtime 0700. Nenhum listener
  VNC/HTTP novo em TCP. Clipboard VNC desligado e uma conexao por vez.
- Console iniciado sob demanda, sessao visual limitada a dez minutos.
- A autenticacao de transporte e SSH; nao ha password VNC em URL ou HTML.
  Root e o usuario tecnico tem acesso ao socket. O tunel local e restrito a
  loopback e deve ser fechado quando terminar a autenticacao.
- Perfil, processos, portas e credenciais Salesforce permanecem independentes.
- ACL nominal somente de travessia (`--x`) no pai dos releases; sem listar o
  diretorio, alterar sua mascara ou adicionar o usuario ao grupo root.

## Preparacao e login

Revisar o PR e validar scripts/testes antes de instalar. Usar checkout limpo,
root-owned, com SHA completo em `/srv/descomplica-crm-releases/SHA` e somente
dependencias do lockfile ja aprovadas. Nao executar build ou suite pesada na
VPS compartilhada. Prerequisitos Chrome/Xvfb/xauth/x11vnc ja devem existir;
o instalador nao instala pacotes nem substitui instalacoes anteriores.

```bash
bash ops/qlik/vps/install-session.sh SHA_COMPLETO_VALIDADO
systemctl start descomplica-qlik-browser.service
systemctl start descomplica-qlik-vnc.service
systemctl start descomplica-qlik-console.service
```

Conferir usuario, modos, sockets privados e ausencia de listeners CDP e
VNC TCP antes de abrir o tunel no computador:

```powershell
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:6082:/run/descomplica-qlik/console.sock descomplica-crm-vps
```

Abrir `http://127.0.0.1:6082/`, conectar e autenticar na pagina real do Qlik.
O console rejeita Host/Origin diferentes dessa origem, acesso cross-site,
traversal e clientes simultaneos. Uma indisponibilidade de socket/Chrome deve
ser investigada; nao expor VNC/CDP ou relaxar permissao para contornar.

Depois do login, encerrar o tunel e parar apenas console/VNC. Preservar o
navegador e seu perfil. Habilitar o browser no boot somente depois de CI e
verificacao operacional; isso mantem o processo, nao comprova sessao valida.

```bash
systemctl stop descomplica-qlik-console.service descomplica-qlik-vnc.service
```

## Contrato antes de coletar

O ranking de corretores ja recebe o snapshot global da ingestao Salesforce.
O relay Qlik existente trata imobiliarias e nao aceita o contrato por corretor.
Nao publicar dados de corretores nesse relay nem inventar um dashboard para
reutilizar o endpoint Salesforce. Nao manter dois writers substituindo global.

Com a sessao da VPS autenticada, confirmar IDs de objetos, filtros de empresa,
identidade do corretor/gerente, datas, periodos, paginacao e totais de cada
relatorio. Versionar contrato e publicacao atomica com proveniencia, replay e
fonte explicitamente escolhida antes do primeiro envio. Validar carga e replay
antes de habilitar agenda. Logs devem conter somente status, datas e contagens,
nunca registros, cookies ou credenciais.

O bloqueio `policy_pending` do ranking por pontos continua independente da
conexao. A pagina de referencia e as configuracoes legadas nao aprovam pesos,
bonus, desempate ou premios. Publicacao da aplicacao continua exclusivamente
pelo coordenador `pnpm release:production`, com PR/CI e gates vigentes.

## Credencial opcional na VPS

O console permite cadastro inicial em `Credencial Qlik`, somente depois de
instalar o cofre com `ops/qlik/vps/install-credential-vault.sh` conforme os
pre-requisitos do script. A requisicao fica no loopback local e atravessa o
tunel SSH; usuario/senha nao passam pelo chat, Git, n8n ou logs. Nao abrir
portas publicas nem reutilizar esse formulario fora do console privado.

O servidor cifra o payload com AES-256-GCM e protege sua chave com RSA-OAEP
SHA-256. Chave privada root0600 em `/etc/descomplica-qlik`; gateway nao pode
le-la. Envelope em diretorio privado de credenciais, sem endpoint de leitura
ou substituicao. Status retorna somente se existe cadastro, sem usuario/senha.
Campos sao limpos depois do envio; erros nao devolvem corpo nem credenciais.

O cofre protege o arquivo em repouso, nao um host comprometido: root pode ler
a chave e o processo recebe a senha em memoria durante o cadastro. O perfil
Chrome tambem contem a sessao. O cadastro nao executa login, nao contorna MFA
e nao comprova credencial valida. Ainda falta um consumidor autorizado para
reautenticacao/coleta. Backup deve preservar chave privada e envelope sem
exporta-los para repositorio ou chat; rotacao exige procedimento explicito.

## Reversao

Parar as tres unidades Qlik e desabilitar somente o browser Qlik caso tenha sido
habilitado. Preservar perfil e evidencia de instalacao. Nao apagar dados,
cookies, locks de perfil ou alterar Salesforce/n8n para recuperar a sessao.
Retirada definitiva do perfil exige pedido especifico.

## Ensaio de 14/10/2026

Preparacao operacional instalada a partir de `2f0907e366b066222a6ff5e4560f3ffb23a1d3ad`,
sem promover o CRM. O primeiro probe nao-root recusou acesso ao pai dos releases
apos criar usuario/perfil, antes de instalar units. Recuperacao manual limitada:
confirmados usuario/perfil privados, units ausentes e causa ACL; concedida apenas
travessia nominal, repetido probe nao-root com sucesso e instaladas as tres units
do mesmo SHA apos `systemd-analyze verify`. Nao removidos perfil ou locks.
O instalador versionado passa a tratar essa ACL nas novas instalacoes; continua
recusando instalacoes parciais/preexistentes, sem retomada automatica.

Browser, VNC e console ficaram ativos, browser desabilitado no boot; console
Unix 0600, runtime/perfil 0700. Tunel local SSH em 6082 respondeu HTTP 200.
O controle automatizado do Chrome retornou `ERR_BLOCKED_BY_CLIENT` para o endereco
local; nao foi contornado. Login/validacao visual transferidos ao usuario.
Autenticacao Qlik, coleta, reconciliacao e agenda permanecem pendentes.

O cofre foi adicionado a partir de `ff1f59d8dc301cb8cd5a2374bb241c1005953458`.
Smoke Linux sob usuario Qlik aprovado com dados sinteticos, sem tocar no destino
da credencial real: escrita por fd ancorado, arquivo0600, sobrescrita recusada
e leitura da chave privada negada com EACCES. Console passou para esse candidato;
navegador permaneceu no candidato anterior, sem reinicio. Backup da unit em
`/var/backups/descomplica-qlik/console-before-ff1f59d.service`.
Antes do cadastro pelo usuario, `/credentials/status` retornou `saved:false`.
Depois da confirmacao do usuario, o status retornou `saved:true` e a tela
remota mostrou Qlik insights/home autenticado. Nenhum segredo foi lido.
A origem Agendamentos abrangia varias regionais e tinha detalhe com timeout;
recorte exato perguntado ao usuario antes de implementar coleta/publicacao.
