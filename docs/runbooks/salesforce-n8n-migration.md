# Migração Salesforce → n8n → Supabase

## Estado seguro

A automação ativa anterior foi preservada. O workflow
`Descomplica CRM - Salesforce Ingest Candidate (inactive)` foi criado inativo,
sem credencial e sem node HTTP externo. Ele valida apenas a forma agregada e
rejeita campos de PII conhecidos. O workflow não deve ser ativado nem receber o
destino de produção antes dos gates deste runbook.

O publisher local origem→n8n também nasce desligado por
`SALESFORCE_N8N_PUBLISH_ENABLED=false`. Quando habilitado, ele falha fechado:
envia somente o objeto `.payload` do candidato, por HTTPS sem credenciais na
URL, usa um Bearer exclusivo lido de arquivo regular privado (`0600` no POSIX;
ACL owner-only validada no Windows) e limita o corpo a 1 MB. Sucesso exige a
confirmação final do CRM em HTTP `200` ou `201`, JSON com `ok=true` e o mesmo
`requestId`; um aceite intermediário `202` do n8n não autoriza considerar a
carga concluída.

O MCP n8n não está disponível nesta sessão. Portanto o workflow remoto não foi
validado, atualizado, relido nem ativado. Não houve fallback por REST. Quando o
MCP estiver disponível, qualquer mudança deve executar
`validate_workflow_code` antes de `update_workflow` e reler o workflow depois.

O workflow ativo `Funil de Vendas` recebeu em 6 de agosto uma alteração externa
de estoque que grava e remove linhas no Supabase antigo. Essa alteração não faz
parte desta migração, não foi modificada e não deve ser copiada para a candidata.

O `Atualizar Funil Salesforce` responde em cerca de 200 ms porque apenas aceita
o disparo assíncrono do exportador. Por isso suas execuções `success` não provam
o processamento completo. Após a inclusão externa de estoque, o exportador
passou a expirar aguardando o download de interface e não alcança o envio final;
o último processamento completo observado no transformador foi às 16:04 UTC de
6 de agosto. A candidata usa API para todos os sete relatórios e valida o fim da
coleta antes de produzir o snapshot.

## Sessão manual e ciclo de 30 minutos

### Estado exibido no CRM

`Conectar Sistemas` separa a autenticacao, a exportacao completa e a publicacao
confirmada. Abrir o Salesforce pelo link da pagina nao conecta o coletor. O
operador continua responsavel por usuario, senha e MFA no Chrome dedicado.

O monitor testa a Analytics API com a sessao desse Chrome e envia somente
estado, horarios e contagens dos sete reports a `POST /api/salesforce/status`.
Nao envia senha, cookie, token Salesforce, conteudo de relatorio ou mensagens
de erro do terceiro. O endpoint exige Bearer proprio, JSON estrito de ate 8 KiB,
observacoes recentes e ordenadas. A leitura exige `crm.settings.manage`.

Configurar o mesmo segredo aleatorio exclusivo (32 a 4096 caracteres) em:

- CRM: `SALESFORCE_STATUS_ENABLED=true` e `SALESFORCE_STATUS_SECRET`, somente no servidor.
- Coletor: `SALESFORCE_STATUS_ENABLED=true`, `SALESFORCE_CRM_ORIGIN` HTTPS e
  `SALESFORCE_STATUS_SECRET_FILE`, caminho absoluto de arquivo privado.

Esse segredo nao e o Bearer de ingestao nem o do n8n. Os exemplos versionados
permanecem desativados e sem segredos. O monitor integrado ao observador de
30 minutos envia uma verificacao a cada 45 segundos, apos cada resposta.
`pnpm salesforce:monitor` verifica apenas a sessao, sem exportar/publicar.
Nao executar o monitor isolado simultaneamente com o monitor do observador:
um unico coletor e a autoridade desse estado.

O estado e efemero no processo Node da aplicacao, com validade de 120 segundos.
Sem novas verificacoes ele muda para sinal vencido. Reinicio ou rotacao do
segredo volta a aguardar verificacao; isso nao apaga o snapshot no Supabase.
Horarios/contagens no painel sao evidencias do processo atual, nao um historico
duravel. Esta implementacao atende uma replica Node, como no compose atual;
antes de escalar para multiplas replicas, mover o recibo a um armazenamento
compartilhado com as mesmas garantias de ordem e expiracao.

`Conectado` prova acesso ao report de verificacao, nao a todos os reports nem
a publicacao. Os sete reports so recebem contagens apos uma exportacao completa.
`Ultima publicacao` so avanca quando o publisher recebeu a confirmacao final
do CRM para o mesmo requestId. Uma falha posterior preserva essa evidencia
historica e sinaliza a falha atual, sem declarar a base atualizada.

### Continuidade e limites

O coletor e o Chrome precisam permanecer ligados na mesma maquina. Com o PC
desligado, somente um servidor com sessao grafica dedicada e login/MFA manual
aprovado pelo operador pode manter essa modalidade em execucao. Um servidor
headless ou n8n sozinho nao substitui essa sessao. Nao instalar ambiente grafico,
copiar perfil pessoal ou enfraquecer MFA para contornar esse requisito.

A autenticacao pode expirar ou ser revogada. Nesse caso, a coleta interrompe a
publicacao e o operador precisa autenticar novamente. Nao existe garantia de
sessao permanente. Ver
[seguranca de sessao Salesforce](https://help.salesforce.com/s/articleView?id=sf.security_overview_sessions.htm&type=5)
e [execucao assincrona de reports](https://developer.salesforce.com/docs/analytics/salesforce-analytics-rest-api/guide/sforce-analytics-rest-api-get-reportdata.html).

Cada coleta cancela a extracao apos um prazo de 25 minutos, com timeout por requisicao e
tentativas limitadas apenas para leituras idempotentes. Iniciar uma instancia
de report nao e repetido automaticamente apos resposta ambigua. Resultados
truncados, `allData` ausente/falso sem particao valida, formato inconsistente ou
falha em qualquer fonte bloqueiam o candidato. Nenhuma carga parcial deve
substituir os dados existentes. A gravacao atomica e sua limpeza precisam
terminar antes de liberar o lock, mesmo apos cancelamento; I/O de disco pendente
nao autoriza iniciar outro escritor. Falha de rede depois do envio nao prova
que o CRM recusou a carga: o estado e publicacao nao confirmada ate reconciliar
o requestId, sem repetir o envio com identidade nova por causa desse erro.

Um lock exclusivo ao lado do candidato impede outro processo de coletar para
o mesmo destino. Se houver interrupcao forcada, conferir que nenhum coletor
esta ativo antes de remover manualmente esse lock. Nao ha desbloqueio por idade
ou remocao automatica de lock pertencente a outro processo. Usar sempre o mesmo
caminho canonico de candidato para esta integracao.

A extração candidata não depende de Connected App, client secret ou refresh
token do Salesforce. O operador autentica manualmente, inclusive por MFA, em um
Chrome com perfil exclusivo para esta integração. Esse MFA manual é uma decisão
operacional intencional, não uma etapa que o exportador deva automatizar ou
contornar. O exportador reutiliza o `sid` somente em memória para chamar a
Analytics Reports API; o cookie não é gravado em arquivo, log, n8n ou banco.

O Chrome deve executar na mesma máquina do exportador, manter uma aba aberta em
`direcional.my.salesforce.com` ou `direcional.lightning.force.com` e expor CDP
somente em `127.0.0.1`, `::1` ou `localhost`. Perfil pessoal, CDP remoto e
credencial embutida na URL são rejeitados. Antes de cada coleta, o exportador
recarrega a aba e confirma novamente o cookie da origem exata. Redirecionamento
para login ou ausência do `sid` falha fechado e pede nova autenticação manual.
Uma aba aberta ou controlada pelo Codex não é uma sessão CDP reutilizável e não
substitui o Chrome dedicado iniciado pelo operador com depuração em loopback.

Na estação gráfica do operador, copiar a configuração local, ajustar caminhos
absolutos nativos e criar o diretório pai privado do candidato. O arquivo
`ops/salesforce/.env` é ignorado pelo Git e é carregado pelos comandos Salesforce:

```bash
cp ops/salesforce/export.env.example ops/salesforce/.env
install -d -m 0700 "$HOME/.local/state/descomplica-crm/salesforce"
```

No PowerShell, usar `Copy-Item`, uma pasta exclusiva em `$env:LOCALAPPDATA` e o
caminho absoluto correspondente no `.env`. O candidato recebe ACL exclusiva do
usuário atual; o Bearer origem→n8n também precisa passar pela validação de ACL.
Nenhum valor real deve ser salvo no arquivo de exemplo versionado.

Depois, iniciar o Chrome dedicado com:

```bash
pnpm salesforce:chrome
```

O launcher procura o Chrome oficial em caminhos fixos de Windows, macOS ou
Linux, cria um perfil exclusivo marcado, abre o workspace Salesforce
em janela visível e aguarda o CDP em `127.0.0.1:9222`. Ele recusa root, Linux
sem sessão gráfica, perfil relativo/pessoal, porta já ocupada, `--no-sandbox` e
endpoint que anuncie debugger fora do loopback. Caminho do executável, perfil e
porta podem ser ajustados somente pelos overrides documentados em
`ops/salesforce/export.env.example`; URL e porta divergentes são rejeitadas.

O login e o MFA precisam ser concluídos nessa nova janela. O MFA já feito em
uma aba interna do Codex não é transferível. Depois, ainda com o publisher
desligado, executar uma coleta única antes de iniciar o observador.

O ciclo local pode ser iniciado com:

```bash
pnpm salesforce:export:watch
```

Ele executa imediatamente e depois nos limites de cada meia hora. Uma coleta
termina antes da próxima começar, portanto duas extrações não se sobrepõem. Uma
falha de sessão não encerra o observador: depois que o operador concluir nova
MFA na aba dedicada, o próximo ciclo pode prosseguir. A recarga periódica reduz
expiração por inatividade, mas não contorna timeout absoluto ou revogação
definidos pelo terceiro.

`ops/salesforce/export.env.example` documenta a URL CDP local, o caminho absoluto
do candidato protegido, a data opcional de referência e o publisher desligado.
Com o publisher desligado, o ciclo gera apenas o arquivo candidato owner-only
(`0600` POSIX ou ACL Windows). A flag de publicação só pode mudar depois que URL
HTTPS e arquivo privado do Bearer origem→n8n forem provisionados e o workflow
cumprir os gates abaixo. O Bearer origem→n8n é diferente do Bearer n8n→CRM.

## Fonte autorizada

| Chave         | Report ID            | Identidade usada na transformação                  |
| ------------- | -------------------- | -------------------------------------------------- |
| oportunidades | `00OU600000DrfDeMAJ` | `Opportunity` 006 retornado em `recordId`          |
| agendamentos  | `00OU600000ELaA6MAL` | código de agendamento, único e obrigatório         |
| visitas       | `00OU600000EboNZMAZ` | código de agendamento, sem exigir correspondência  |
| pastas        | `00OU600000EjufWMAR` | avaliação a1V e vínculo 006 quando disponível      |
| vendas        | `00OU600000EjFyyMAF` | `Opportunity` 006 retornado em `recordId`          |
| corretores    | `00OTT000009j0l32AA` | `Contact` 003, convertido para hash no `brokerKey` |
| Canal Imob    | `00OU6000006RqzxMAC` | conta 001 e nome da conta, sem campos de contato   |

Os IDs brutos existem na resposta da API, mas eram descartados pela geração do
XLSX legado. A candidata mantém os IDs apenas durante a transformação. O
`brokerKey` persistido é `sf-contact-` seguido de 32 caracteres hexadecimais de
SHA-256; IDs Salesforce brutos não entram no payload final.

## Projeção mínima

O exportador envia ao transformador somente os campos necessários:

- oportunidade: ID, criação, corretor, gerente, imobiliária, unidade e empreendimento;
- agendamento/visita: código, data, corretor, gerente, imobiliária e empreendimento;
- pasta: ID da avaliação, vínculo de oportunidade, data, corretor, gerente,
  imobiliária, empreendimento e status;
- venda: ID da oportunidade, data, corretor, gerente, imobiliária,
  empreendimento e valor;
- corretor: Contact ID, nome e status;
- Canal Imob: conjunto único de nomes de contas.

CPF, CNPJ, dados bancários, telefone, e-mail, data de nascimento e endereço não
são projetados, transportados ou persistidos.

## Regras

- as três visões são completas e mutuamente exclusivas: geral, contas presentes
  no relatório Canal Imob e restante;
- pastas do dashboard preservam todas as linhas únicas da avaliação;
- `approvedFolder` do ranking conta somente `Análise aprovada`;
- visitas sem agendamento, pastas sem oportunidade e vendas sem oportunidade
  permanecem nas métricas e aparecem somente como contagens diagnósticas;
- top empreendimentos usa oportunidades, evitando contar novamente a mesma
  passagem por pasta e venda;
- corretor ativo usa Contact ID estável; associação com atividades ocorre por
  nome normalizado e falha de gerente fica explícita;
- roleta não existe nos sete relatórios. O contrato v2 envia
  `rouletteAvailable=false`, mantém zero apenas como armazenamento técnico,
  exclui roleta da pontuação e mostra “Dados indisponíveis” na interface;
- metas não são calculadas pelo exportador. O contrato v2 envia
  `goalsAvailable=false`; o dashboard mostra “Fonte não configurada” e não
  apresenta progresso, atingimento ou gap como indicador comercial.

## Primeira coleta candidata

A execução controlada de 6 de agosto de 2026 retornou:

| Relatório     | Linhas |
| ------------- | -----: |
| corretores    |     27 |
| contas Imob   |      4 |
| oportunidades | 11.914 |
| agendamentos  |    816 |
| visitas       |    352 |
| pastas        |    465 |
| vendas        |    595 |

O contrato final contém três views, quinze métricas e 108 participantes de
ranking (27 corretores × quatro períodos). A validação encontrou 63 visitas sem
agendamento, 19 vínculos de pasta fora do recorte de oportunidades, 18 vínculos
de venda fora do recorte e 122 pastas aprovadas. As comparações por ID e por nome
produziram os mesmos totais. Nada foi descartado por essas divergências. O
relatório de oportunidades é recortado pela criação em 2026, enquanto pastas e
vendas podem referenciar oportunidades anteriores. Cinco dos 27 corretores
ativos ainda não possuem gerente resolvido e 195 nomes históricos/externos das
atividades não pertencem à base ativa atual; ambos permanecem diagnósticos, sem
criar identidades sintéticas.

## Baseline vigente após reconciliação

A auditoria somente leitura de 7 de agosto confirmou que 385 oportunidades
foram criadas na fonte depois do snapshot anterior, sem remoção ou duplicidade.
O relatório manteve escopo, definição e filtro; os doze registros criados em
07/08 UTC pertencem a 06/08 no fuso `America/Sao_Paulo`. Um corretor teve o
status alterado na fonte e deixou legitimamente o relatório, removendo seus
quatro períodos do ranking.

| Relatório     | Linhas vigentes |
| ------------- | --------------: |
| corretores    |              26 |
| contas Imob   |               4 |
| oportunidades |          12.299 |
| agendamentos  |             816 |
| visitas       |             352 |
| pastas        |             465 |
| vendas        |             595 |

O payload reconciliado passa a ter 104 participantes. Permanecem 63 visitas
sem agendamento, 19 pastas e 18 vendas fora do recorte, 122 pastas aprovadas,
quatro corretores sem gerente resolvido e 195 nomes de atividade fora da base
ativa. A evidência detalhada sem PII está em
[`docs/SALESFORCE_BASELINE.md`](../SALESFORCE_BASELINE.md).

## Gates antes da primeira escrita

1. aplicar as migrations de reconciliação em ambiente isolado e obter a contagem
   pgTAP exigida pelo commit: 229 e 1.099 são referências históricas
   desatualizadas, e o HEAD atual exige 1.104; nenhuma dessas contagens é
   evidência de execução remota nesta etapa;
2. confirmar no alvo que `anon` não acessa tabelas, que `service_role` não tem
   acesso direto às tabelas Qlik e executa somente as três RPCs de ingestão
   auditadas do schema atual: `ingest_crm_imob_ranking_snapshot`,
   `ingest_crm_read_model_v3` e `ingest_crm_salesforce_snapshot`;
3. manter publisher e candidata n8n inativos e validar o snapshot completo pelo
   schema Zod;
4. manter `goalsAvailable=false` até existir fonte oficial de metas;
5. manter `rouletteAvailable=false` até existir fonte oficial de roleta;
6. fazer backup protegido do Supabase novo e validar leitura/checksum;
7. gerar Bearers exclusivos para origem→n8n e n8n→CRM, mantendo o primeiro em
   arquivo regular privado (`0600` POSIX ou ACL owner-only Windows);
8. pelo MCP n8n, completar autenticação, schema v2 e o único envio HTTP para o
   CRM; validar antes do update e reler depois, ainda sem ativar a agenda;
9. habilitar somente `SALESFORCE_INGEST_ENABLED` e manter
   `SALESFORCE_REFRESH_ENABLED=false`;
10. iniciar um Chrome/CDP dedicado, concluir MFA manual e enviar uma única
    requisição; exigir confirmação CRM `200/201` com o mesmo `requestId`;
11. reconciliar contagens, RLS, Auth e auditoria, sem promover o snapshot se
    houver divergência;
12. repetir exatamente o mesmo `requestId` e confirmar resposta idempotente;
13. somente depois habilitar o publisher e ativar uma agenda de 30 minutos com
    lock não bloqueante.

O estado indisponível de metas e roleta foi autorizado para a primeira carga em
6 de agosto de 2026. Ele não autoriza inventar metas, percentuais ou eventos de
roleta. Antes da escrita, o PR deve ter todos os checks do GitHub Actions verdes
e a migration v2 deve passar por dry-run/auditoria e ser aplicada isoladamente.

A primeira carga e a agenda permanecem bloqueadas enquanto faltar qualquer um
destes itens: workflow n8n completo e relido por MCP, Chrome/CDP dedicado com
MFA manual vigente e reconciliação da requisição única. O refresh continua
desligado durante todo esse processo.

## Rollback

- desativar imediatamente a candidata;
- definir `SALESFORCE_INGEST_ENABLED=false` e reiniciar somente o container da aplicação;
- manter o workflow antigo e seus backups sem alterações;
- o snapshot anterior do CRM permanece substituível por uma nova ingestão mais
  recente; não executar SQL manual, reset, seed ou limpeza;
- para restaurar configuração n8n, usar o export protegido e checksum capturados
  antes da mudança, nunca um JSON copiado para o repositório.
