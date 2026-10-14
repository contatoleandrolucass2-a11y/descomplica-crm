# Rotina compartilhada

## Contrato

- `/app/gestao/rotina` e GET `/api/routines`: `crm.dashboard.view`.
- PUT `/api/routines`: `crm.settings.manage`, origem da aplicacao e JSON limitado.
- RPCs `get_crm_routines` e `save_crm_routine`: identidade, conta ativa,
  assurance e permissoes verificadas novamente no banco. Sem service role.
- `crm_routines` guarda uma versao global por funcao, sem dados de clientes.
  RLS forcada; acesso direto revogado para public, anon, authenticated e service_role.
- Gravacao exige a revisao recebida na leitura. Zero cria; revisao obsoleta
  retorna conflito sem sobrescrever. Auditoria guarda somente metadados.
- Limites: seis funcoes, 200 linhas por funcao, sete dias no formato legado,
  4.000 caracteres por celula. Domingo preservado no dado, oculto na interface.

## Conclusoes individuais

- GET/PUT `/api/routines/completions` exigem `crm.dashboard.view`. Concluir
  uma atividade propria nao concede permissao para editar o texto compartilhado.
- O servidor identifica o usuario pela sessao; a requisicao nao recebe user_id.
  A tabela de conclusoes nao permite acesso direto e as RPCs repetem os guards.
- Cada marca identifica funcao, linha, dia e texto salvo da atividade.
  Atividade vazia, rascunho nao salvo ou texto substituido nao herda conclusao.
- A semana e calculada no banco em America/Sao_Paulo. Segunda-feira as 00h
  inicia um novo conjunto vazio para todos os usuarios, sem depender de cron,
  navegador aberto ou exclusao de historico. Domingo ainda pertence a semana
  anterior; nada reinicia diariamente. Uma requisicao atrasada nao marca a nova
  semana usando uma confirmacao da semana anterior.
- A interface usa a hora e o proximo limite informados pelo servidor. Revalida
  por intervalo, foco e retorno a aba; uma falha nao aparece como salvamento.
  O checkbox grava separadamente de Salvar alteracoes e conserva a tipografia.
- A migration aditiva de conclusoes tem autorizacao especifica do usuario em
  13/10/2026, condicionada a testes e backup. Nao aplicar outras migrations
  pendentes. Registrar ausencia dos objetos novos, schema/ACL e historico antes
  de aplicar; rollback da aplicacao preserva os dados e nao derruba a tabela.
- Validar isolamento entre dois usuarios, permissao de leitor, MFA, virada
  domingo/segunda, dispositivo com hora divergente, falha e concorrencia.

## Transicao do conteudo

A ausencia de registro usa a rotina inicial versionada. Salvar cria o registro
da funcao atual ou grava as funcoes editadas. Outros usuarios veem o mesmo dado
ao abrir a pagina; a tela sem rascunho consulta novamente ao receber foco e a
cada 30 segundos. A resposta antiga de uma consulta nao substitui uma edicao.

O localStorage antigo nao e enviado automaticamente. O editor pode importar
a copia da funcao atual, revisar e salvar no CRM. O original local permanece
intacto. Falha no armazenamento local nao impede carregar o servidor.

Em conflito, o rascunho permanece na tela e Salvar fica bloqueado. Recarregar
exige confirmacao antes de descartar o rascunho. Falha de rede nao equivale a
sucesso; uma confirmacao perdida pode resultar em conflito na tentativa seguinte.

## Publicacao

1. Validar lint, tipos, testes, build, pgTAP e CI completa no SHA candidato.
2. Confirmar projeto pelo SUPABASE_URL do runtime, nao somente pelo nome.
3. Registrar backup dos objetos afetados: linhas completas das duas app_pages,
   schema/ACL e historico anterior. Se tabela/RPCs nao existirem, registrar a
   ausencia. Nao exportar usuarios ou dados de clientes para esta mudanca.
4. Aplicar somente `20261013014310_crm_shared_routines.sql` autorizada, sem
   executar outras migrations pendentes. Verificar RLS, ACL e definicoes.
5. Promover imagem pelo coordenador release:production conforme runbook.
6. Conferir health/SHA e leitura autenticada. Validar gravacao com conteudo
   aprovado, nunca inserir fixture de teste em producao.

A migration e aditiva e mantem as permission keys existentes, evitando rejeicao
de contexto por versoes anteriores. Rollback de runtime preserva dados novos;
nao derrubar tabela nem apagar rotinas para reverter interface. Durante rollback,
a versao antiga volta ao salvamento local e nao atualiza o registro compartilhado.

## Evidencias

Apresentacao: Semana/Hoje e Inserir linha ficam antes de Salvar no cabecalho.
Apenas os dias da tabela acompanham a rolagem abaixo do menu. O dia atual e
destacado somente no cabecalho, sem pintar a coluna. Atividades pendentes usam
o fundo da pagina; somente a celula concluida recebe o gradiente azul e o check.
Hover/foco usam contorno sem ampliar celulas nem colorir atividades pendentes.
O controle fica no canto superior esquerdo na semana e antes do texto em Hoje,
em trilho fixo que alinha os controles verticalmente. Ambas as vistas usam o
mesmo estado individual, sem copiar ou salvar marcacoes separadas.
A tabela nao cria barras internas: a pagina rola verticalmente e, na semana,
horizontalmente apenas se a largura disponivel nao comportar os seis dias.
Hoje se ajusta a largura da pagina. Movimento reduzido desativa brilho. Assinatura
fica diretamente no fundo do rodape da Rotina, alinhada a direita, sem faixa
nem borda e sem alterar o rodape global. Entrada e brilho seguem da direita
para a esquerda; movimento reduzido deixa o texto estatico.
O credito fica branco no tema escuro e usa texto contrastante nos temas claros;
a ausencia da faixa exige verificar contraste tambem sem animacao.

O ajuste de altura mede campos invisiveis fora do fluxo da tabela, nunca
encolhe todos os editores visiveis para medir. Esse encolhimento temporario
limitava a rolagem no refresh de 30 segundos, causando salto ao inicio mesmo
com o mouse nas ultimas linhas. A regressao verifica rolagem, foco e selecao
com refresh por intervalo/foco, Semana/Hoje e desktop/mobile. Foco solicitado
explicitamente por teclado ou insercao de linha permanece funcional.

`supabase/tests/crm_shared_routines.test.sql`, `tests/routine-api.test.ts`,
`tests/routine-settings.test.tsx`, `scripts/qa/routine-settings.mjs` e matriz
de autorizacao E2E. Evidencias reais de publicacao ficam em ATUALIZACOES.md.
