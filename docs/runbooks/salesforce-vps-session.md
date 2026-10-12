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
- Console noVNC temporario: 127.0.0.1:6080, VNC 5909 com senha propria.
  Transporte criptografado pelo SSH existente. Sem DNS, proxy publico ou
  porta adicional no firewall. A senha VNC nao e a senha Salesforce.
- Clipboard do VNC desativado. Senhas de servico nao entram em argumentos,
  URLs, Git, evidencias, logs nem n8n.
- Navegador supervisionado por systemd, com reinicio limitado e perfil
  preservado. Falha repetida exige diagnostico e reset-failed pelo operador;
  nao ha loop ilimitado nem promessa de disponibilidade absoluta.

VNC classico limita a senha a oito caracteres e nao cifra o transporte.
Por isso loopback + SSH sao requisitos, nao opcoes. A senha e aleatoria;
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

## Login manual

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
