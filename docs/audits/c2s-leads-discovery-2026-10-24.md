# Descoberta funcional do C2S para o futuro menu Lead

status: pesquisa concluida; primeiro incremento de navegacao implementado
data: 2026-10-24
escopo: gestor de leads C2S observado na conta autorizada e fontes publicas

## Objetivo e limites

Este documento organiza o conhecimento necessario para projetar um menu `Lead`
no DESCOMPLICA-CRM. Ele descreve capacidades e fluxos, nao autoriza copiar marca,
codigo, textos, imagens ou dados do C2S. A conta foi usada somente para leitura
da estrutura e dos estados visiveis. Nenhuma credencial, token, lead, proposta,
contato de cliente, nome de colaborador ou captura autenticada foi persistido.

A replica deve adotar os componentes, temas, autorizacao e contratos do
DESCOMPLICA-CRM. O C2S serve como referencia funcional e de jornada.

## Limite entre os produtos C2S

As fontes atuais descrevem produtos e modulos diferentes:

- O Gestor de Leads centraliza, distribui e acompanha leads.
- O novo CRM C2S Imob amplia o produto para imoveis, condominios,
  proprietarios, site e publicacao em portais.
- O C2Sgo oferece atendimento centralizado pelo WhatsApp oficial.
- A Vetra adiciona qualificacao e acompanhamento com inteligencia artificial.
- Bolsao, Leads Turbo, integrador WhatsApp, bots e outros recursos dependem da
  contratacao ou ativacao da conta.

Nao se deve combinar automaticamente esses produtos em um unico escopo. O
primeiro incremento do menu `Lead` precisa ter uma lista de capacidades aprovada.

Em 24/10/2026, o primeiro corte foi limitado ao hub, Lista de leads, Atividades
e Funil em modo seguro sem fonte configurada. Ele não cria banco, integração,
cadastro, distribuição ou comunicação e não altera as demais etapas deste plano.

## Inventario observado na conta

A navegacao autenticada apresentou as seguintes areas:

1. Leads.
2. Dashboards.
3. Gestao.
4. Meu C2S.
5. Produtos: C2S IA e Gestor de Imoveis + Site.
6. Imoveis.
7. Hierarquia.
8. Bolsao.
9. Leads Turbo.
10. Funil.
11. Usuarios.
12. Financeiro, em beta.
13. Modulos WhatsApp.
14. Relatorios.
15. Distribuicao de leads.
16. Importacao e integracoes.
17. Configuracoes.

Configuracoes inclui Portais, Motivos de arquivamento, Alerta de clientes sem
atendimento, Ajustes, Auditoria e Etiquetas. WhatsApp inclui qualificacao,
integrador, pesquisa de satisfacao, pagamentos e conexao Meta. Relatorios inclui
Geral, Visitas e Negocios Fechados, Metricas de desempenho, vendas por origem,
vendas por natureza da negociacao, Leads, Acompanhamento de Uso e relatorio por
imovel.

## Area Leads

### Lista e trabalho diario

A pagina de leads oferece pesquisa por produto, nome, telefone ou e-mail e cinco
visoes:

- A fazer: atividades vencidas ou do dia.
- Visitas: compromissos de visita.
- Futuras: proximas atividades.
- Favoritos.
- Todos: historico completo, inclusive finalizados.

Os filtros observados foram usuario, natureza da negociacao, status, situacao,
canal, fonte, atividade, motivo de arquivamento, etiqueta, atendimento por bot,
faixa de preco, periodo de criacao e periodo de negocio fechado.

O vazio informa a ausencia de leads e oferece cadastro manual. Esse estado deve
ser distinto de erro, indisponibilidade ou falta de permissao.

### Cadastro manual

O formulario observado foi dividido em quatro blocos:

- Cliente: nome, e-mail, celular principal e telefone secundario, com pais.
- Produto: natureza da negociacao, titulo, codigo do anuncio, cidade, bairro,
  link e preco.
- Forma de entrada: canal e fonte.
- Encaminhamento: usuario responsavel, atribuicao automatica pelas preferencias
  e mensagem interna.

Compra, aluguel, lancamento e captacao apareceram como naturezas. Showroom,
telefone, rede social e WhatsApp apareceram como canais. A API tambem documenta
Internet e campos especificos para imoveis ou veiculos.

### Estado e historico

A API publica os estados novo, em negociacao, convertido, negocio fechado,
arquivado, resgatado, pendente, recusado e finalizado. Um lead agrega:

- cliente e produto/interesse;
- empresa e responsavel;
- origem, canal e natureza da negociacao;
- status do lead e etapa do funil;
- favoritos, etiquetas e colaboradores;
- mensagens, logs e atividades agendadas;
- motivo de perda, dados de fechamento e datas operacionais;
- primeira mensagem, observacao, URL e atributos customizados.

As acoes publicas incluem criar, consultar, atualizar, encaminhar, marcar como
interagido, adicionar mensagem ou atividade, aplicar etiquetas, atualizar
status/perda e registrar negocio fechado.

## Funil de vendas

O funil autenticado possui tres visoes:

- Kanban.
- Analise do Funil, em beta.
- Consultores, em beta.

A analise aplica filtros de periodo, fonte, consultor, equipe e natureza da
negociacao. Ela apresenta funil instantaneo e de fluxo, motivos de arquivamento,
performance por fonte, lead scoring por etiqueta e arquivados por etapa.

A visao de consultores apresenta consultores ativos, conversao media, negocios
fechados e receita. A tabela compara leads recebidos, fechamentos, conversao,
tempo ate a primeira resposta, ticket e receita. A replica nao deve misturar
contagem de atividade com elenco cadastrado.

## Distribuicao

O modulo apresenta filas ordenadas por prioridade e um usuario de seguranca. A
criacao de fila separa:

- configuracao basica e ativacao;
- regras e condicoes;
- horarios e check-in;
- usuarios ativos;
- configuracoes avancadas;
- redistribuicao;
- presenca depois do encerramento do check-in;
- preservacao da posicao durante indisponibilidade temporaria.

As fontes oficiais acrescentam regras por bairro, cidade, formulario Meta,
origem, palavra-chave, imovel, faixa de preco, natureza e titulo, alem de pesos,
limite de carteira, memoria do cliente, plantao e rodizio. A memoria mantem o
mesmo cliente com o mesmo atendente dentro do periodo configurado.

O modulo tambem possui:

- auditoria com periodo, equipe, fila, autor e registro modificado;
- captacoes com busca e sincronizacao;
- check-in por QR Code;
- explicacao de por que um lead foi entregue a determinado usuario.

## Atendimento e relacionamento

As fontes oficiais descrevem ligacao, e-mail e WhatsApp, mensagens prontas,
registro de interacoes, alertas e lembretes. A area Meu C2S mostrou convite para
visita, alerta de leads, integrador WhatsApp, colaboracao entre usuarios, link
personalizado, relatorio de imoveis, API, Zapier e RD Station.

Os bots cobrem qualificacao e pesquisa de satisfacao. Leads Turbo cobre campanhas
para leads. A Regua de Relacionamento publica casos de primeiro contato,
complemento de perfil, reativacao e fidelizacao. Esses recursos exigem decisao
separada sobre comunicacao, consentimento, opt-out, templates, limites e custos.

## Gestao, relatorios e administracao

- Gestao oferece periodos predefinidos, filtros por negociacao e empresa e
  dashboards personalizados.
- Usuarios permite buscar, filtrar, convidar, exportar e reenviar convite.
- Hierarquia organiza empresas e equipes.
- Financeiro lista faturas, pagamentos, notas fiscais e contatos; fica fora do
  escopo de Lead salvo pedido expresso.
- Auditoria registra horario, equipe, registro, autor e alteracao.
- Etiquetas permitem criar, editar, filtrar e exportar.
- Motivos de arquivamento sao configuraveis.
- Alertas identificam equipe, tempo sem atendimento, destinatario e ativacao.
- Ajustes cobrem duplicidade manual, visibilidade da fila e link de anuncio.
- Importacao aceita planilha, cabecalho, status e atribuicao automatica ou a um
  usuario. Exportacoes e planilhas envolvem dados pessoais e exigem controles.

O dashboard novo permaneceu em carregamento durante a observacao e nao foi
considerado evidencia funcional. A area Gestao e os relatorios forneceram a
evidencia disponivel.

## Modelo de dados proposto como referencia

Entidades confirmadas nas fontes publicas:

- Lead, Customer, Product e LeadStatus.
- Seller/User, Company/Sub-company e equipe/hierarquia.
- Tag, Message, Activity e AuditLog.
- LeadSource, Channel, LostReason e NegotiationType.
- DistributionQueue, DistributionRule e QueueSeller.
- WebhookSubscription, HierarchyBlocklist, SalesStand e AttendanceSummary.

A implementacao propria deve usar IDs internos estaveis e adaptadores nas
fronteiras. A API C2S mistura IDs criptografados e numericos, nomes em portugues,
aliases em ingles e contratos legados com grafia `schedulated_*`; isso nao deve
vazar para o dominio interno sem normalizacao versionada.

## API e integracoes

A documentacao oficial publica a base
`https://api.contact2sale.com/integration`, autenticada por token. Ela cobre:

- empresa autenticada e subempresas;
- leads, mensagens, atividades, etiquetas, encaminhamento e fechamento;
- vendedores, empresas e etiquetas;
- regras e filas de distribuicao;
- webhooks de criacao, atualizacao e fechamento;
- blocklist de telefone/e-mail;
- estandes de vendas e resumos de atendimento.

Leads usam paginacao de ate 50 itens e filtros por atualizacao, criacao, status,
etiquetas, telefone e e-mail. Criacao exige telefone ou e-mail. Webhook permite
somente um endpoint por token; nova assinatura substitui a anterior. Antes de
qualquer integracao real ainda faltam validar rate limit oficial, retries,
assinatura, idempotencia, exclusao, escopo de token e campos contratados.

## Autorizacao, privacidade e seguranca

O C2S se declara operador e o cliente, controlador. A replica precisa tratar o
DESCOMPLICA-CRM como autoridade e aplicar:

- permissoes independentes por pagina e acao;
- autorizacao de servidor, grants minimos e RLS;
- trilha de auditoria;
- finalidade, retencao e minimizacao de dados;
- bloqueio de exportacao sem permissao;
- fixtures sinteticas em desenvolvimento e teste;
- segredo de integracao somente no servidor;
- idempotencia e proveniencia em ingestao;
- consentimento e opt-out em comunicacoes.

Perfis amplos de master e usuario comum nao substituem a matriz granular do
DESCOMPLICA-CRM. A existencia de um item no menu nao concede acesso ao dado.

## Arquitetura futura no DESCOMPLICA-CRM

O menu deve nascer como raiz `Lead`, rota `/app/leads`, chave `crm.leads` e
permissao propria. Cada capacidade aprovada deve ser um filho com rota e
permissao independentes. A ordem sugerida para entrega incremental e:

1. Hub Lead, lista, busca, filtros, vazio e detalhe somente leitura.
2. Cadastro, edicao, historico, atividades, etiquetas e encerramento.
3. Funil Kanban e analitico.
4. Filas, regras, atribuicao e auditoria.
5. Relatorios e dashboards.
6. Importacao/exportacao.
7. Integracoes, webhooks e canais de comunicacao.
8. Modulos opcionais somente apos aprovacao individual.

Cada nova pagina exige registro em `lib/navigation/registry.ts`, permissao em
`lib/authorization/permissions.ts`, guard de servidor, `pages:sync`, migration
do catalogo e entrada em `docs/knowledge/recursos.json`. Tabelas novas exigem
migration, RLS, grants minimos e pgTAP.

## Pendencias antes da implementacao

- Definir quais modulos fazem parte da primeira entrega.
- Definir fonte autoritativa dos leads: banco proprio, Salesforce, C2S ou
  conciliacao versionada.
- Definir papeis e permissoes por pagina e acao.
- Definir canais permitidos e requisitos de consentimento.
- Definir retencao, deduplicacao, identidade do contato e auditoria.
- Confirmar comportamento mobile e diferencas entre web e aplicativo.
- Confirmar os campos customizados e modulos efetivamente contratados.
- Projetar estados de indisponibilidade sem transformar ausencia em zero.

## Fontes

- [Site do Gestor de Leads](https://www.contact2sale.com/)
- [Distribuicao inteligente](https://www.contact2sale.com/distribuicao-leads-inteligente/)
- [Novo CRM C2S](https://www.contact2sale.com/blog/crm-c2s/)
- [Termos de uso](https://www.contact2sale.com/termos-condicoes-de-uso/)
- [Politica de privacidade](https://www.contact2sale.com/privacidade/)
- [Guia de ajuda](https://sites.google.com/view/guiadeajudac2s/)
- [Documentacao oficial da API](https://docs-api-leads.c2sapp.com/)
- [Referencia completa da API](https://docs-api-leads.c2sapp.com/llms-full.txt)
- Navegacao autenticada somente leitura em `api.contact2sale.com`, realizada em
  24/10/2026, sem persistir credenciais ou dados pessoais.
