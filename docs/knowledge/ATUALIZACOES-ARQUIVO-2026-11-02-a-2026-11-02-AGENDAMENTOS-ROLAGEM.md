# 2026-11-02 — Agendamentos: recência e rolagem integral

## Implementação e validação local

RecencyPanel conserva os mesmos dados e faixas, com índice, barra proporcional
aos dias em relação ao maior valor da lista, data sob o responsável e gerente
separado. CSS reaproveita o padrão dos rankings, sem divisórias, com hover,
rolagem e ajuste móvel. Nenhum perfil salvo foi reescrito.

A tabela usa loadAllDetails com all:true, fora dos filtros. O servidor mantém
autorização da página e da view, snapshot e mascaramento, filtra/ordena antes
de retornar todas as linhas com cursores nulos. All com cursor é inválido.
A leitura padrão e o bootstrap continuam limitados a 50; o cliente esconde
resultados parciais até receber a lista completa. Cache separado por modo,
limitado a oito entradas, deduplicado entre cópias. Resposta incompleta é erro
recuperável; mudança de snapshot invalida todas as cópias. CSV preservado.
Sem migration, alteração de ACL/RLS ou escrita em dados comerciais.

Windows/Node 24.19/Next 16.4.1: 20 testes de controller/actions aprovados. Cobrem
123 linhas integrais, 62 filtradas, 123 vencidas, autorização, snapshot,
mascaramento, cursores, concorrência e resposta parcial. ESLint e Prettier
dos seis arquivos delegados aprovados. UI/resumo/SSR:19 casos aprovados na
rodada inicial; o caso existente de 20 mil registros excedeu 5s duas vezes
(5,67/6,42s). Reexecução isolada, com timeout apenas da CLI de 15s, passou em
5,61s. Tipos globais e ESLint focado aprovados. Não houve mudança de timeout,
baseline ou asserts no pipeline; CI Linux
no SHA candidato continua obrigatória. Não inferir latência de produção disso.

Roteiro tests/appointments-detail.browser.mjs aprovado: 136 linhas simultâneas,
sem paginação, scroll até a última, CSV136, filtros rápidos sem resposta antiga,
arraste/redimensionamento/cópia sem novas consultas e snapshot alterado sem
mistura de dados. Evidência: test-results/appointments-detail/result.json.

QA integrado com componentes/CSS reais e transporte sintético: seis cenários
(três temas × 1440/390px), recência 25, detalhes 136, vencidos 73 e cópia 136.
Observador do DOM viu somente 0/136/73, nunca a página parcial de 50. Uma consulta
all por recorte; cópias deduplicadas. Última linha acessível por rolagem,
CSV 136/73/136, sem sobreposição, overflow horizontal, erro JS ou acesso externo.
Capturas e hashes em test-results/appointments-reading-integral. Isso não
substitui CI, saúde, autorização real ou smoke depois da publicação.

Revisão independente do diff não demonstrou quebra de autorização, recorte,
mascaramento ou snapshot. Não repetiu testes nem consultou dados de produção.
O retorno integral cresce conforme o filtro autorizado; não há truncamento
silencioso. Renderização do limite de 20 mil linhas não foi medida no navegador.

## Abertura — 21:50Z

Git comum confirmado, árvore limpa, base8697ade2. PR472 integrado; CI documental
41526888903 aprovada no head68f17e07 e CI41527166188 aprovada no merge8697ade2.
Os jobs pesados foram ignorados pela classificação documental, sem nova imagem.
Health público em2026-11-02T21:50:12.511Z: HTTP200/ok/2556898d; coordenador com
deployment28c48a83 e nenhuma operação pendente. Main documental difere do runtime
como esperado. Fontes: gh PR472, Actions41527166188,
https://crm.descomplicapro.com.br/api/health e release:production status.

Escopo solicitado: recência no padrão visual dos rankings de conversão; tabela
de detalhamento com todos os resultados do filtro em uma lista com rolagem,
sem botões de paginação. Preservar autorização, snapshot, mascaramento,
filtros e exportação. Nenhuma alteração de outra página, dados comerciais,
permissões, n8n ou schema autorizada por contexto. Não repetir migrations já
aplicadas. Implementação, testes e publicação desta nova alteração pendentes.

## Histórico preservado integralmente do índice

## Reconciliação após CI aprovada

A segunda CI41555902549 também aprovou os quatro jobs do heada00b9bb4.
Main avançou para6a0b1df5 e a proteção strict do GitHub recusou a integração
como BEHIND (três checks exigidos na base atual). A nova integração local
preservou integralmente a entrega concorrente, sem conflitos de código.
Dependências compartilhadas de Agendamentos mantêm defaults e acrescentam
somente filteredBrokerRoster; testes focados foram reconferidos na combinação.

As migrations20261102020840/20261102020921 da entrega concorrente não estavam
no ledger de produção na consulta observacional. Não foram aplicadas por este
chat. Revisão restrita de compatibilidade constatou: menu usa app_pages
persistidas/autorizadas, guard exige página ativa e RPC ausente falha como
indisponível. Portanto app-first não demonstra quebra de Agendamentos; isso
não conclui nem autoriza ativar Equipe Produtiva. CI completa da combinação
e do main exato permanecem obrigatórias antes da publicação.

CI41534244751 aprovou os quatro jobs do head10c6132a. Antes do merge, main
avançou para855f32d6 com uma atualização autorizada do protocolo de publicação.
O GitHub recusou o merge por conflito somente em CHANGELOG, WORKLOG e índice
do conhecimento. Os dois conteúdos foram preservados; código funcional de
Agendamentos permanece igual ao candidato testado. As regras integradas de
main foram relidas, sem alterações incidentais nesta demanda. Nova CI do
head reconciliado e depois do main exato continuam obrigatórias.

A soma dos registros ultrapassava o limite de exportação. Somente a própria
nota histórica de Agendamentos de29/10 foi movida integralmente abaixo, com
referência no índice;1765bytes preservados, índice255090bytes antes do formato.
O registro da outra entrega e suas regras não foram removidos ou reescritos.

## 2026-10-29: Agendamentos — sete achados corrigidos

- Pedido e escopo: A1–A7 da análise de Agendamentos, com merge e publicação
  autorizados. Base main b48ce8b4; produção observada a36de843e, health ok.
  Nenhuma outra página, permissão, política comercial ou migration foi alterada.
- Cadastro: empresa, ranking e canal sem elenco correspondente exibem base
  indisponível; não usar só quem teve movimento como total cadastrado. Regional
  das linhas é a original; facts usam observação de vínculo até a data civil,
  sem atribuir uma regional quando o vínculo é desconhecido ou conflitante.
  A base cadastral regional exige vínculo estável em todos os dias cobertos
  selecionados, sem usar o vínculo de fechamento para movimentos anteriores.
- Metas: cada competência vem da RPC autorizada; períodos compostos ponderam
  o funil mensal pelos dias cobertos selecionados. Ausência não usa meta atual.
- Apresentação: rolagem interna funcional sem barras visuais, wrappers de altura
  limitada ao card, Hoje limpa restrições temporais e preserva dimensões. Meta,
  torre e rótulo usam a mesma escala, com espaço para o máximo de 150% do editor.
  Ampliação preserva apresentação mediante opção ativada apenas em Agendamentos.
- Validação local: 87 testes focados, tipos, ESLint e formatação aprovados.
  Navegador usa dados sintéticos locais e não grava perfil em produção. CI,
  merge e publicação são estados posteriores, ainda não comprovados nesta nota.
- Limite: elenco atual não contém histórico próprio de transferências ou vínculo
  com empresas/Imob; indisponibilidade explícita preserva a leitura honesta.
  Fontes: diff da branch codex/agendamentos-sete-correcoes e testes relacionados.

## 2026-10-30: tamanho e ordem persistidos ao sair e voltar a Agendamentos

- Pedido específico: sair de Agendamentos, voltar e comprovar tamanho e posição, com print. Antes da navegação, foram registrados os 28 IDs em ordem e os valores DOM de width/height. A saída ocorreu pelo link Visão Geral e a URL https://crm.descomplicapro.com.br/app foi confirmada. O link de retorno estava oculto e as tentativas de abrir Lead não o tornaram disponível à ferramenta; sem investigar ou alterar a navegação global, foi usado o endereço conhecido https://crm.descomplicapro.com.br/app/etapas/agendamentos para retornar. Não alegar teste aprovado do menu Lead ou de outras jornadas.
- Depois do retorno e carregamento do perfil, as listas completas de 28 registros (ID, width e height) foram comparadas: igualdade integral de ordem e dimensões. Exemplos observados: Visitas realizadas em 4º, 317×237 px; Agendamentos por semana em 15º, 477×439 px; Previstos e realizados hoje em 16º, 441×441 px. Nenhum editor, reconfiguração, arraste ou salvamento manual foi necessário neste teste; layouts e filtros não foram alterados.
- Print nativo após o retorno em test-results/appointments-first-save/sair-voltar-resultado.jpg e resumo sanitizado sair-voltar-resultados.json, ignorados pelo Git. Captura do cabeçalho aos gráficos, sem rankings ou tabela de clientes. Listas contêm apenas identificadores de cards e dimensões, sem registros pessoais; não exportar imagem ou anexos ao GitHub/Obsidian. Aba de resultado mantida aberta.
- Fontes atuais: árvore inicialmente limpa; HEAD/origin main e807357f650988e3a5b9870a487362f97ef3041c após fetch; CI documental main 41114951426 em andamento na consulta. Health público às 2026-10-30T19:28:57Z respondeu 200/ok/version 8d0d1a732fb008da2d5c1b162d5c61a66fb97ecd. CI funcional 41093030466 aprovada para esse runtime, reutilizada porque este complemento não muda código. Fontes: https://crm.descomplicapro.com.br/api/health e GitHub actions/run 41114951426.
- Aceite aprovado para sair à Visão Geral e voltar por navegação direta, na sessão e viewport observados. Não extrapolar para troca de usuário/dispositivo, menu indisponível ou coordenadas absolutas em layouts responsivos. Somente registro documental e sync, sem novo deploy, alteração de dados comerciais ou mudança de permissões.

## Reconciliação documental de main em 03/11 UTC

Main avançou de6a0b1df5 para b19da16a somente por registro da publicação CAIXA. Conflitos limitados a WORKLOG/CHANGELOG preservaram ambos os blocos. Código funcional inalterado; resultados focados reutilizados, mas proteção strict exige nova CI do head atualizado. O índice voltou a exceder256000bytes com a nota concorrente; somente a própria nota histórica de Agendamentos acima foi movida integralmente, com referência, sem reescrever a outra entrega. Produção foi atualizada por outro coordenador para6a0b1df5; a próxima promoção deve usar consulta ao vivo e CAS novos.

## Reconciliação com registro de Equipe Produtiva

Durante CI41568899145, main avançou de b19da16a para38bec742 somente em CHANGELOG, WORKLOG e arquivo de conhecimento de outra entrega. Merge local limpo preservou esses documentos. Código de Agendamentos permanece inalterado; não há novo teste local justificado. A proteção strict exige CI do novo head antes de integrar. Sem migration, mudança de permissão ou ação sobre dados remotos por este chat.

## 2026-10-29: candidato completo — redimensionamento livre de Agendamentos

- Esta conclusão substitui o limite por colunas do candidato inicial: a interface agora usa largura e altura em pixels, flex-wrap e dimensões individuais. Limites técnicos: largura 128..16384 px e altura 72..16384 px; o tamanho visível respeita a tela. Cards sem width continuam compatíveis. Controles compactos e cabeçalho removido mantidos; outras páginas preservadas.
- Migration 20261029210251_appointments_free_card_dimensions.sql preparada pelo CLI, com wrapper privado específico da página. Dimensões originais são validadas; catálogo, apresentação, duplicados, RPCs, auth, RLS, grants e CAS são preservados. Não houve aplicação remota nem alteração de dados. Rollback após novos layouts exige imagem compatível ou recuperação de dados autorizada; procedimento em docs/runbooks/appointments-card-dimensions.md.
- Evidências locais: 81 testes focados de interface/API/schema aprovados entre as suítes do coordenador e crm-dados; types e lint aprovados. Chromium aprovou largura 317 px, altura 997 px preservada, dimensões 157×137 px, ajuste de 1 px, histórico, editor, grupo, expansão e transporte no endpoint sintético. Toque mantém controles visíveis e alvos 44 px. Matriz de 5 larguras×3 temas sem overflow/sobreposição/axe grave; falha inicial do alvo em toque foi corrigida e a etapa reexecutada com sucesso. Nenhum erro JS ou tráfego externo; CSS Vite não substitui build Next/CI.
- SQL/pgTAP não executados localmente porque Docker/psql não estão disponíveis. Nova CI isolada obrigatória; resultados do candidato inicial c6910cf3 não validam esta extensão. PR #424 será atualizado. Migrations remotas exigem autorização específica segundo AGENTS.md; interface não será publicada contra o contrato antigo. Pendências: CI, integração, autorização/aplicação da migration, artefato aprovado, publicação protegida e verificação posterior.

- Revisão independente do candidato completo identificou e corrigiu perda da largura salva ao alterar só a altura em tela menor e recorte de ações de toque em cards estreitos. Resize vertical preserva width/span originais; resize horizontal usa a largura renderizada. Toque usa ícone de ações que abre modal externo ao card; editor oferece as dimensões sem recorte. Readonly não exibe resize em mobile. Browser aprovado em 128×72 px, com menu/editor, Escape/foco e expansão; regressão de 1000 px salvos/358 px visíveis coberta por teste e cenário real de viewport menor.
- CI 40955427661 falhou em quatro asserts de inventário diretamente decorrentes da nova migration e 15 pgTAP adicionais (demais 4511 testes aprovados). Atualizados somente os inventários: 95 migrations; nova versão explicitamente não publicável pelo fluxo Auth/MFA; 2321 pgTAP em 44 arquivos. Nenhum guard, hash histórico, workflow ou baseline foi relaxado. Os 33 testes focados de homologation/release-candidate passaram. Nova CI necessária após os fixes; SQL remoto permanece não aplicado.

- O restore isolado da CI 40956446681 executou 2321 pgTAP e encontrou uma única divergência causada pelo wrapper novo: card malformado sem layout deveria conservar a mensagem invalid_argument: invalid dashboard card, mas recebia invalid dashboard card layout. Corrigida a validação estrutural antes da validação dimensional; a asserção antiga foi preservada, sem atualizar baseline. Os outros 2320 testes passaram nessa fase. A correção precisa de nova CI; o restante da execução atual segue produzindo evidência dos gates independentes. Houve também aviso de limite de downloads Docker no job, sem alteração de credenciais ou fontes para contornar.

- Autorização específica recebida neste chat em 29/10/2026: o usuário selecionou “Autorizar a migration após CI verde” para a migration de Agendamentos do PR #424. Aplica-se somente a esse ajuste de dimensões, sem reescrever perfis existentes ou alterar permissões; não vira autorização para migrations futuras. Aplicação e publicação continuam condicionadas aos gates e às verificações finais.
- CI 40958768864 no head 22c991b2 aprovou validate, promotable-image e isolated-restore; release-gates ainda em execução. O ensaio isolado já valida a correção da mensagem de erro e o restore; isso não comprova aplicação remota.
- Preflight observacional de produção: projeto Supabase hnncxuerlcsaahdxoswb, nome descomplica-crm-production, ACTIVE_HEALTHY, conferido contra o hostname público do runtime. A migration de dimensões está ausente no histórico consultado. Funções privadas atuais pertencem a postgres, security_definer=false e ACL postgres-only; hashes MD5 de definição: assert_dashboard_profile_document=1c8a81f7c82da19b8457a73db6e134fc; assert_dashboard_profile_document_v2=4d385ba688c56dbf5469e8efa733e3a8. O nome assert_dashboard_profile_document_presentation_v2 ainda não existe. Consulta limitada a metadados e definição do validador, sem leitura de registros de clientes/perfis.
- Ledger observado: SHA 5fbf6f0ea3fbecc52d12bdc765b9f8acffd4bc40, deploymentId 42da50c3-9988-40f3-844d-9eab3fbab24d, deployedAt 2026-10-29T19:27:23.595Z, sem inProgress. Fonte: campos sanitizados do ledger de produção e host público do env via SSH. Esta observação não substitui a consulta no minuto/CAS do release:production; repetir antes da mutação/promoção após CI verde.

## Encerramento atual do PR474 — 03/11/2026

PR474 integrado em d83c949707bb92a367db26210d3c870bf93d042f; CI41575950480 concluiu quatro gates aprovados após repetição somente do job que falhou na inicialização. Código comprovadamente publicado dentro de f3c4f126 e preservado na versão conjunta82ee8deb38b5c86f9781504f60c673ee69d9ab44, CI41654312258 aprovada, health200/ok. Pendências dos registros anteriores são históricas; não republicar candidato antigo. Correções adicionais e testes finais reais136/84, persistência32cards e celular constam no arquivo AGENDAMENTOS-METAS de03/11. Sem pendência funcional desta entrega; complemento final apenas documental, sem reiniciar aplicação.
