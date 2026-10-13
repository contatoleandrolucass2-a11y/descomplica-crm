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

## Transicao

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
Apenas os dias da tabela acompanham a rolagem abaixo do menu. Gradientes e
realce seguem a referencia visual, sem modificar a pagina de metas. Hover/foco
destacam linha e coluna na semana e somente linha no dia; a ampliacao sutil nao
redimensiona a grade. Movimento reduzido desativa brilho e ampliacao. Assinatura
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
