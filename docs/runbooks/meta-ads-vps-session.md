# Sessão Meta Ads na VPS

## Escopo e estado da entrega

Esta etapa prepara uma sessão independente do Facebook Ads no navegador da VPS e
seu acesso pela página Integrações do CRM. A conta de anúncios autorizada é
`1080988750909489`, no business `310106776631136`.

O destino fixo é o [Gerenciador de Anúncios solicitado](https://adsmanager.facebook.com/adsmanager/manage/campaigns/?global_scope_id=310106776631136&business_id=310106776631136&act=1080988750909489&nav_entry_point=am_global_scope_selector).
Os parâmetros temporários de navegação não são persistidos. Não há nova página
comercial, coleta de métricas, importação de leads, exportação de campanhas,
agendamento de coleta ou publicação de anúncios nesta etapa. Esses contratos
dependem da próxima definição do usuário.

Arquivos versionados e testes locais não comprovam instalação, login ou operação.
O instalador permanece sem execução nesta entrega. A conexão só pode ser
confirmada depois da implantação autorizada, configuração privada pareada e
login/MFA feito pelo operador no navegador real da VPS.

## Isolamento

- Usuário de sistema `descomplica-meta-ads`, sem shell, sudo ou acesso ao Docker.
- Perfil persistente `/var/lib/descomplica-meta-ads/chrome`, diretório `0700`,
  proprietário dedicado e marcador próprio. Um perfil existente sem marcador,
  symlink ou permissões abertas é recusado; não copiar perfis pessoais.
- Chrome oficial com sandbox nativo. O supervisor de processos puro é reutilizado
  de Salesforce; a configuração, o perfil e a sessão Salesforce não são lidos.
- Xvfb no display `:101`, Xauthority privado em
  `/run/descomplica-meta-ads/Xauthority`, sem listener TCP do X11.
- CDP fixo `127.0.0.1:9224`, VNC autenticado em `127.0.0.1:5911`, gateway em
  `127.0.0.1:6083`. Conferir novamente todas as portas e o display na instalação.
  Não encaminhar CDP/VNC para a internet nem para o computador do operador.
- O console usa HTTPS/WSS do CRM existente. Clipboard permanece desativado.
- Root e o usuário dedicado podem acessar o perfil; ambos pertencem ao domínio de
  confiança do host. Não oferecer essa conta de sistema a terceiros.

VNC clássico aceita oito caracteres e não cifra o transporte. A senha técnica
aleatória gerada pelo instalador protege o VNC no loopback; o acesso externo
depende de TLS, autenticação e autorização Master do CRM. Essa senha não é a senha
da conta Meta. Não imprimir senhas, bearer, cookies, tokens, conteúdo de campanhas
ou dados pessoais em terminal, logs, evidências, capturas ou chat.

## Contratos do console

O botão de conexão abre o navegador real dedicado. Login, senha e MFA são inseridos
pelo operador diretamente na página Meta, sem formulário intermediário de senha,
cópia de sessão pessoal ou captura de credenciais pelo CRM.

`POST /api/meta-ads/console` exige sessão CRM válida, MFA aplicável, acesso à página
`/app/configuracoes/conectar-sistemas` pela permissão própria do catálogo
`crm.settings.connected_systems.view`, papel Master e `Origin` exatamente aprovado.
A revogação ou desativação da página também impede o acesso pelo servidor. A credencial
técnica VNC chega somente à memória do cliente, com `no-store`; não deve entrar em
URL, localStorage ou props SSR. A aplicação mantém essa opção desabilitada até
que sua configuração privada esteja pareada.

O WebSocket `/meta-ads-console/socket` passa pelo bloco HTTPS do Nginx e pelo
gateway dedicado. Antes de encaminhar bytes ao VNC, o gateway valida caminho,
origem e cookie; consulta `GET /api/meta-ads/console/authorize` no loopback fixo
`127.0.0.1:3000`, sem seguir redirecionamentos. Revalida a mesma identidade a cada
30 segundos. Falha, timeout, troca de sujeito ou perda de autorização encerra a
conexão. O acesso tem duração máxima de dez minutos e admite apenas uma conexão
pendente ou ativa por vez, sem tomar uma sessão já aberta.

Fechar o console encerra sua conexão de tela. Chrome e perfil continuam na VPS.
Isso não garante duração da sessão Meta: expiração, revogação, exigência de MFA,
restrição da conta ou políticas do provedor podem exigir intervenção humana.

## Monitor de sessão

O monitor se conecta apenas ao CDP dedicado. Inspeciona a URL e a interface
visível; não lê cookies, tokens, armazenamento do navegador ou APIs internas da
Meta. Não clica em controles nem altera campanhas. O DOM é reduzido dentro da
página a indicadores booleanos; textos da conta ou das campanhas não saem do
navegador.

Para não renovar um estado baseado em DOM antigo, o monitor recarrega somente a
rota canônica de campanhas, sem parâmetros desconhecidos, hash com conteúdo, campo de edição
focado, diálogo, área editável ou controle de rascunho/publicação visível. Antes
de recarregar, obtém uma reserva exclusiva de até 25 segundos no gateway local e
revalida a interface dentro dessa reserva. Enquanto ela existir, uma nova abertura
do console recebe conflito; enquanto um console estiver pendente ou aberto, o
monitor não consegue reservar nem recarregar. A prova positiva sempre vem do DOM
posterior ao reload. Redirecionamento a login ou conta diferente substitui o
estado anterior. Falha do gateway, console ativo ou impossibilidade de reserva
produz `unavailable`, nunca um novo `connected`.

O login interativo pode acrescentar parâmetros transitórios à rota de campanhas.
A validação aceita `biz_login_source` somente com o valor
`biz_unified_f3_fb_login_button`, e `join_id` ou `redirect_session_id` somente como
UUID v4 válido. Parâmetros duplicados, inclusive quando seus nomes usam codificação
percentual, são recusados. Um `#` vazio ao final é permitido; fragmentos com
conteúdo e parâmetros de seleção/edição permanecem bloqueados. Esses valores são
validados apenas em memória, não aparecem no heartbeat e não são persistidos.
Os controles globais “Descartar rascunhos” e “Conferir e publicar” com contagem
não caracterizam edição isoladamente; formulários, diálogos e áreas editáveis
continuam bloqueando o reload.

A coordenação usa `GET /session-active`, `POST /session-probe` e
`DELETE /session-probe` exclusivamente em `127.0.0.1:6083`. A reserva possui um
identificador aleatório, expira automaticamente e é liberada ao fim da prova.
Essas rotas não entram no Nginx. Rejeitam `Origin`, cookies, Fetch Metadata,
Host divergente, corpo não vazio, transferência chunked, métodos e caminhos
inesperados, evitando que a página Meta controle a reserva via acesso do navegador
ao localhost. O monitor usa HTTP nativo, sem proxy nem redirecionamento.

Uma prova positiva exige, simultaneamente:

1. Origem HTTPS exata `adsmanager.facebook.com`, conta e business esperados, sem
   parâmetros de identidade duplicados ou ambíguos.
2. Uma única página reconhecida do Ads Manager, sem outra página de login/MFA.
3. As abas/títulos visíveis de Campanhas, Conjuntos de anúncios e Anúncios, em
   português ou inglês, e o ID exato da conta em um controle visível de seleção.
4. Ausência de campo de senha/login ou mensagem reconhecida de acesso negado.
5. Recarregamento concluído dentro da reserva exclusiva do gateway, com prova
   extraída da interface atualizada e nenhuma edição identificada.

URL correta isolada, janela aberta, cookie existente ou login concluído pelo
operador não são prova suficiente. Se a Meta mudar o DOM, o idioma ou ocultar o
ID da conta no seletor, o monitor fica indisponível até que a regra seja revisada
com evidência autorizada. Não afrouxar a regra para produzir um conectado falso.
Login em `business.facebook.com/business/loginpage/` também exige reautenticação.

O monitor envia somente `POST /api/meta-ads/status`, a cada 45 segundos após a
conclusão de uma verificação, com bearer independente lido de arquivo privado.
O contrato estrito contém `version: 1`, `observedAt` ISO, `accountId`, `businessId`
e `state`, que pode ser `connected`, `reauth_required`, `unavailable` ou
`wrong_account`. Não inclui contagens, métricas ou dados pessoais. Falhas não
renovam o último recibo válido; o CRM vence a evidência após 120 segundos.

## Instalação inicial, sem ativação automática

Seguir [o coordenador de publicação](production-release-guard.md), incluindo CI
do SHA exato, imagem imutável, backup, rollback, lock compartilhado e CAS. Conferir
versão ativa, data real do último deploy e publicação em andamento no mesmo minuto
da promoção, com evidência de no máximo 60 segundos. Não promover candidato já
ativo, contornar gates ou confundir configuração escrita com configuração aplicada.

1. Confirmar autorização operacional e capacidade da VPS. Revisar usuário, portas,
   display e serviços existentes. Preservar Salesforce, Qlik, Nginx e CRM.
2. Preparar checkout aprovado, limpo, root-owned e sem escrita para grupo/outros
   em `/srv/descomplica-crm-releases/SHA`, com dependências do lockfile. A etapa
   usa Node `24.19.x`, `@playwright/test`, `ws` e `zod` já previstos no projeto.
   Não executar build ou suites pesadas na VPS compartilhada.
   Os arquivos e as dependências devem permitir leitura e travessia pelo usuário
   dedicado. As dependências precisam ser cópias locais root-owned, sem hardlinks,
   symlinks para fora de `node_modules` ou escrita por grupo/outros. O instalador
   inspeciona metadados como root e só importa pacotes depois de reduzir privilégios.
3. Confirmar dependências existentes: Chrome oficial, Xvfb, xauth, x11vnc e
   tigervncpasswd. O instalador não instala pacotes, altera repositórios ou atualiza
   serviços. Dependência ausente bloqueia a instalação para análise separada.
4. Executar como root, somente após revisão do SHA aprovado:

```bash
bash ops/meta-ads/vps/install-session.sh SHA_APROVADO_DE_40_CARACTERES
```

O instalador recusa usuário, grupo, diretório, unidade, perfil, porta ou display já
existentes. Verifica o SHA, a integridade e as permissões dos módulos usados,
incluindo o supervisor reutilizado, e a lista exata de quatro unidades. Acrescenta
somente uma ACL de travessia `--x` para `descomplica-meta-ads` no diretório pai dos
releases, com `--no-mask`, sem conceder listagem ou alterar a máscara das demais
ACLs. Confirma o acesso efetivo e importa os módulos como o usuário dedicado,
com ambiente limpo, antes de instalar unidades. Se o release ou suas dependências
forem inacessíveis, interrompe sem instalar serviços. Cria segredos com
`0600`, usa stdin para codificar a senha VNC, substitui apenas o caminho imutável
do release e executa `systemd-analyze verify`. Deixa todos os serviços parados.
Uma instalação parcial exige inspeção; não apaga dados nem tenta sobrescrever
automaticamente uma instalação anterior.

## Pareamento privado e ativação

Os arquivos `/etc/descomplica-meta-ads/monitor.env` e
`/etc/descomplica-meta-ads/gateway.env` são root-owned `0600`; systemd os lê antes
de reduzir privilégios. O monitor começa com `META_ADS_STATUS_ENABLED=false`.

Preparar o pareamento por leitura local protegida, sem imprimir valores e sem
editar `production.env` manualmente:

- Copiar o conteúdo de `/var/lib/descomplica-meta-ads/status-bearer` para
  `/etc/descomplica-crm/secrets/meta-ads-status-bearer` com proprietário
  `root:root`, modo `0600`. O segredo deve ter 32 a 256 caracteres ASCII do
  alfabeto permitido pelo contrato; o instalador gera 96 caracteres hexadecimais.
- Copiar o conteúdo de `/etc/descomplica-meta-ads/operator-vnc-password` para
  `/etc/descomplica-crm/secrets/meta-ads-console-password`, também `root:root`,
  `0600`, com exatamente oito caracteres. Manter o diretório de segredos privado.
- `META_ADS_CRM_ORIGIN` e `META_ADS_CONSOLE_ORIGIN` com a origem HTTPS real.
- Definir `META_ADS_STATUS_ENABLED=true` no arquivo privado do monitor apenas
  quando sua ativação estiver autorizada.

No deploy protegido de um SHA novo e aprovado, usar `--meta-ads enable` no
coordenador `pnpm release:production`. Ele lê os dois arquivos privados e pareia
`META_ADS_STATUS_SECRET` e `META_ADS_CONSOLE_PASSWORD`, habilita os dois flags do
CRM, preserva as demais variáveis e registra backup com CAS. A opção exige todos
os gates do [runbook de publicação](production-release-guard.md); não é um
comando de ativação independente nem permite republicar o SHA já ativo.
Os serviços e o proxy devem estar preparados antes de aplicar essa configuração.
Editar um env não atualiza um container em execução; não usar Compose, alteração
manual de `production.env` ou restart direto para contornar o coordenador.

Adicionar somente o bloco de
`ops/meta-ads/vps/nginx-console.conf.example` ao servidor HTTPS existente. Preservar
os blocos Salesforce/Qlik, fazer backup privado, executar `nginx -t` e só então
recarregar. Não criar DNS ou regra pública para as portas dedicadas.

Após implantação e configuração confirmadas:

```bash
systemctl enable --now descomplica-meta-ads-browser.service
systemctl enable --now descomplica-meta-ads-gateway.service
systemctl enable --now descomplica-meta-ads-monitor.service
```

O gateway inicia sua unidade VNC dependente. O operador abre Integrações, conecta
o console Meta Ads, conclui login/MFA e seleciona somente a conta autorizada.
Uma sessão do navegador pessoal ou de outro provedor não é reaproveitada.

## Validação e rollback

Antes de concluir: executar lint, typecheck, testes e build do projeto, os testes
Node em `ops/meta-ads`, `bash -n` no instalador e, no host Linux de destino,
`systemd-analyze verify` das unidades com o release resolvido. Os testes Node
abrangem autorização do gateway, origem/caminho/cookie, revogação, timeout,
limites, duração máxima, isolamento do perfil, prova DOM, contrato e segredos.

Depois de ativar, verificar manualmente listeners apenas no loopback, usuário e
perfil privados, bloqueio de anônimo/não-Master/origem externa, acesso Master,
MFA, prova recente aceita pelo CRM e expiração do status com monitor parado.
Confirmar a conta real no console e o estado `wrong_account` para uma seleção
indevida autorizada de teste. Não declarar essa validação executada com base
apenas em fixtures, health HTTP ou arquivos presentes.

Para retirar apenas o console, parar/desabilitar o gateway, parar a unidade VNC e
remover somente seu bloco Nginx com backup, validação e reload. O navegador e o
perfil permanecem disponíveis. Para interromper toda esta etapa:

```bash
systemctl disable --now descomplica-meta-ads-gateway.service
systemctl stop descomplica-meta-ads-vnc.service
systemctl disable --now descomplica-meta-ads-monitor.service descomplica-meta-ads-browser.service
```

Preservar usuário, perfil, marcador e segredos protegidos. Reverter o código e a
configuração do CRM pelo fluxo de release autorizado. Nenhum rollback desta
integração deve alterar Salesforce, Qlik, campanhas ou dados comerciais.
