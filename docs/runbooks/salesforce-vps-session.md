# Sessao Salesforce na VPS

## Escopo

Etapa solicitada em 12/10/2026: navegador dedicado na VPS Hostinger, com login
e MFA feitos pelo operador. Nao instala/configura n8n, nao exporta relatórios,
nao liga publisher e nao escreve no Supabase. O PC so e necessario para abrir
o console e autenticar; o navegador e seu perfil permanecem na VPS.

O CRM existente recebe a prova de conexao pelo monitor. Abrir o Salesforce no
Chrome pessoal nao autentica esse navegador. Nao embutir o formulario de senha
Salesforce em uma imitacao no CRM nem copiar cookies/perfis pessoais.

## Modelo de acesso

- Usuario de sistema sem shell: descomplica-salesforce, sem sudo nem Docker.
- Chrome oficial, com sandbox nativo, perfil privado persistente 0700.
- Xvfb autenticado por Xauthority 0700/0600, sem listener TCP.
- CDP somente 127.0.0.1:9222, nunca encaminhado para o PC ou internet.
- Console integrado noVNC no CRM: HTTPS/WSS na origem existente, gateway
  127.0.0.1:6081 e VNC 127.0.0.1:5909 com senha tecnica propria.
  Somente Master autorizado no servidor. Nao expor VNC/CDP ao publico.
- Console legado via SSH em 127.0.0.1:6080 fica reservado a manutencao;
  nao executa junto com o console integrado. Nenhum DNS ou firewall novo.
- Clipboard do VNC desativado. Senhas de servico nao entram em argumentos,
  URLs, Git, evidencias, logs nem n8n.
- Navegador supervisionado por systemd, com reinicio limitado e perfil
  preservado. Falha repetida exige diagnostico e reset-failed pelo operador;
  nao ha loop ilimitado nem promessa de disponibilidade absoluta.

VNC classico limita a senha a oito caracteres e nao cifra o transporte.
Por isso loopback + TLS (console integrado) ou SSH (manutencao) sao requisitos.
A senha tecnica e aleatoria;
o arquivo codificado tambem deve ser tratado como segredo. Root e processos
do usuario dedicado continuam no dominio de confianca. Nao oferecer essa
conta a outros usuarios nem expor CDP em interfaces de rede.

## Instalacao

Conferir autorizacao para usar esta VPS, Ubuntu 24.04 amd64, capacidade,
servicos e portas antes de aplicar. Nenhum script altera o CRM/Nginx/Docker.

1. Revisar e executar ops/salesforce/vps/install-prerequisites.sh como root.
   Instala apenas Chrome, Xvfb, xauth, x11vnc, noVNC, websockify e tigervnc-tools.
   Confere a chave Google com fingerprint publicado oficialmente e usa
   signed-by restrito; nao executa upgrade global nem reinicia outros servicos.
2. Aguardar PR/CI aprovada no SHA. Preparar checkout limpo root-owned em
   /srv/descomplica-crm-releases/SHA, com dependencias do lockfile. Nao executar
   builds ou suites pesadas na VPS compartilhada. Nao usar HEAD flutuante.
3. Executar bash ops/salesforce/vps/install-session.sh SHA nesse checkout.
   O instalador recusa instalacao existente, perfil, usuario ou porta ocupada.
   Cria segredos privados no host e valida units. Nao inicia servicos.
4. Conferir unidades e iniciar somente o navegador:

```bash
systemctl enable --now descomplica-salesforce-browser.service
systemctl is-active descomplica-salesforce-browser.service
ss -lnt
```

Chrome/Xvfb usam a mesma unidade; o supervisor espera o processo Chrome.
Fechamento ou falha reinicia a unidade inteira; systemd encerra o cgroup para
nao deixar Xvfb ou Chrome orfaos. Nao excluir locks de perfil automaticamente.

## Console integrado no CRM

O botao Conectar Salesforce abre o navegador real da VPS dentro de um dialogo
do CRM. O operador digita usuario/senha na pagina Salesforce e aprova MFA.
Nao ha formulario intermediario, iframe Salesforce, copia do perfil pessoal,
armazenamento da senha Salesforce no CRM nem dependencia do n8n.

Contrato de acesso:

- POST /api/salesforce/console exige Origin exatamente APP_ORIGIN, sessao
  CRM valida, MFA exigida pelo CRM, crm.settings.manage e role master. Nao
  aceita corpo nem destinos. Retorna a credencial tecnica VNC em memoria do
  cliente, somente com no-store; nunca em props SSR, URL ou localStorage.
- O WebSocket /salesforce-console/socket passa pelo Nginx TLS e pelo gateway.
  O gateway valida origem/caminho/cookie antes de abrir VNC e consulta GET
  /api/salesforce/console/authorize pelo loopback fixo da aplicacao. Repete a
  verificacao a cada 30 segundos; falha, timeout ou perda de permissao fecham
  a conexao. O guard existente consulta o contexto no banco, incluindo sessao
  viva e MFA. Nenhuma conta de servico substitui a identidade do operador.
  Essa sonda nao renova tokens: o proxy nao faz refresh nessa rota e o cliente
  Supabase bloqueia /auth/v1/token antes da rede. Cookie vencido fecha o
  console; reabrir pelo botao renova a sessao no navegador, sem reutilizar
  refresh tokens antigos no gateway ou capturar Set-Cookie remotamente.
- Uma conexao por vez, duracao maxima de dez minutos, sem clipboard. Abrir
  outra aba nao toma o console em uso. Fechar o dialogo desconecta apenas a
  tela: Chrome/perfil continuam na VPS. Isso nao prolonga a sessao Salesforce.
- Autenticacao VNC confirma somente o console. Conectado no Salesforce exige
  prova recente do monitor existente; expiracao exige nova acao do operador.

Preparacao operacional, somente apos PR/CI no SHA exato:

1. Instalar dependencias do lockfile no checkout root-owned aprovado. Conferir
   que o usuario dedicado consegue importar ws sem conceder escrita no codigo
   ou acesso ao cache privado root. Nao executar build/testes pesados na VPS.
2. Instalar a unidade gateway versionada com o caminho do release aprovado e
   EnvironmentFile privado com SALESFORCE_CONSOLE_ORIGIN=https://crm.descomplicapro.com.br.
   Validar com systemd-analyze verify. Conferir browser e VNC no loopback.
3. Parear SALESFORCE_CONSOLE_PASSWORD com a senha VNC tecnica existente por
   leitura local protegida, sem imprimir. Habilitar SALESFORCE_CONSOLE_ENABLED
   somente na configuracao privada; defaults permanecem false. Fazer backup
   privado e CAS, preservar as outras variaveis e parear o monitor conforme
   a secao abaixo. Nunca usar a senha Salesforce nessa variavel.
4. Promover a imagem aprovada exclusivamente pelo coordenador de release.
   Configuracao alterada nao implica container atualizado. Nao contornar gates.
5. Instalar apenas o bloco salesforce-console do template HTTPS no Nginx real,
   preservando outros blocos, com backup, nginx -t e reload. Parar o websockify
   legado; habilitar gateway e monitor. O gateway requer VNC e browser.
6. Validar anonimo/nao-Master/origem externa negados, console sintetico em QA,
   login/MFA manual em producao e prova real no status. Nao salvar screenshots
   com senha, dados de clientes ou conteudo privado do Salesforce.

Rollback do acesso: parar/desabilitar gateway, remover somente o bloco Nginx
adicionado e validar/recarregar. Preservar Chrome, perfil e segredos. Reversao
do codigo CRM continua pelo fluxo PR/CI/release; nao reiniciar app diretamente.
Uma falha do gateway nao deve derrubar o navegador ou alterar dados comerciais.

## Login manual de manutencao via SSH

Fluxo legado reservado ao operador SSH. Parar o gateway antes de usa-lo para
nao abrir duas sessoes sobre o mesmo desktop. Nao parar console.target durante
uso do gateway: esse target tambem controla a unidade VNC compartilhada.

Na VPS, abrir o console apenas durante a autenticacao:

```bash
systemctl start descomplica-salesforce-console.target
```

No PC com acesso SSH autorizado, manter este tunel enquanto usa o console:

```powershell
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:6080:127.0.0.1:6080 descomplica-crm-vps
```

Abrir http://127.0.0.1:6080/vnc.html. Obter a senha de acesso ao console
somente pelo canal SSH privado do operador, a partir do arquivo root-only
/etc/descomplica-salesforce/operator-vnc-password. Nao colar senha neste
runbook, chat, argumento de processo, URL ou screenshot.

Digitar usuario e senha diretamente no Salesforce exibido no console e
aprovar a MFA no celular. Nao solicitar envio da senha Salesforce ao agente.
O launcher abre apenas a origem Direcional fixa. Aguardar prova do monitor;
janela aberta, redirecionamento ou MFA aprovada nao substituem a prova da API.

Depois de autenticar, fechar o tunel e parar SOMENTE o console:

```bash
systemctl stop descomplica-salesforce-console.target
```

Navegador permanece ativo. Desligar o PC nao o encerra. Nenhuma sessao sobrevive
garantidamente a timeout, revogacao, politica de IP ou nova exigencia de MFA do
Salesforce. Detectar reautenticacao, avisar no CRM e repetir este fluxo.

## Monitor e pareamento do CRM

O instalador deixa o monitor desligado e SALESFORCE_STATUS_ENABLED=false.
O segredo aleatorio proprio fica em
/var/lib/descomplica-salesforce/status-bearer, owner-only do usuario dedicado.

Parear esse segredo com SALESFORCE_STATUS_SECRET no ambiente privado do CRM e
habilitar SALESFORCE_STATUS_ENABLED=true nos dois lados. Nao imprimir/copiar
o segredo para arquivos de usuario. Fazer backup privado antes, CAS do arquivo,
preservar todas as outras variaveis e manter ingestao/refresh desligados.

Alterar production.env nao altera o container em execucao. Aplicacao da nova
configuracao deve acompanhar uma promocao pelo coordenador release:production,
com PR/CI, imagem imutavel e travas. Nao usar docker compose direto, wrapper
antigo ou restart fora do protocolo para contornar um noop do coordenador.
Se a promocao nao puder ser feita, manter pareamento pendente e nao afirmar
que o CRM esta conectado. Reavaliar quando os gates da release estiverem verdes.

Depois da aplicacao confirmada, habilitar o monitor:

```bash
systemctl enable --now descomplica-salesforce-monitor.service
```

Ele verifica somente metadados do report a cada 45 segundos e envia estado
para POST /api/salesforce/status. Nunca exporta as linhas. O GET protegido
do CRM so exibe Conectado com prova aceita e recente; recibo vence em 120s.
Contagens continuam sem coleta, e agenda de 30 minutos continua inativa.
Nao executar esse monitor junto com salesforce:export:watch no futuro.

## Validacao e rollback

Validar no SHA exato: lint, typecheck, test, build, testes Node do supervisor
e contrato VPS, bash -n e systemd-analyze verify. Depois da instalacao:

- usuario nao-root, perfil/segredos privados e listeners apenas no loopback;
- console solicita senha, login/MFA manual, CRM indica estado real;
- encerramento do console/tunel nao encerra navegador/monitor;
- restart controlado do navegador, antes do login, recupera CDP sem orfaos;
- falha ou expiracao nunca produz conectado falso;
- nenhuma exportacao, agenda ou escrita Supabase executada.

Para interromper esta etapa, desabilitar navegador/monitor e parar console:

```bash
systemctl stop descomplica-salesforce-console.target
systemctl disable --now descomplica-salesforce-monitor.service descomplica-salesforce-browser.service
```

Preservar perfil e segredos protegidos para investigacao. Nao remover usuario
ou dados automaticamente. Para atualizar, parar os servicos, revisar unidades
com novo SHA aprovado, manter configuracao/perfil, validar e reiniciar; a
primeira versao do instalador intencionalmente nao implementa upgrade.

## Fontes

- [Google: assinatura dos pacotes](https://www.google.com/linuxrepositories/).
- [noVNC: acesso via websockify](https://github.com/novnc/noVNC/wiki/Advanced-usage).
- [Salesforce: seguranca de sessao](https://help.salesforce.com/s/articleView?id=sf.security_overview_sessions.htm&type=5).
- [Contrato de monitor e coleta](salesforce-n8n-migration.md).
- [Coordenador de publicacao](production-release-guard.md).
