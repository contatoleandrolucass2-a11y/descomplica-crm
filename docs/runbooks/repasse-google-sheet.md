# Visão geral e consulta de repasse

## Fonte

- Planilha: `REPASSE MAP - ACOMPANHAMENTO ONLINE / REGIONAL LEANDRO LUCAS`.
- Aba: `Table 1`, `gid=798117742`.
- Colunas autorizadas para projeção: `FID`, `EMPREENDIMENTO`, `ETAPA`, `STATUS`,
  `NOME CLIENTE` e `MOTIVO`.
- A célula `A1` informa a data da última atualização exibida pela página.

A aplicação não escreve, reorganiza nem formata a planilha. Por decisão expressa
do responsável em 06/10/2026, a origem permanece publicada para leitura anônima.
O servidor consulta o datasource Google Visualization fixo em
`docs.google.com/spreadsheets/d/<id>/gviz/tq`, com `gid=798117742`, `headers=0`
e saída CSV. Não há token, chave Google ou variável de credencial no runtime.

Na visão gerencial são lidos `A1:F2` e `A3:E`: FID, empreendimento, etapa,
status e nome do cliente alimentam cartões somente leitura. O motivo não integra
essa carga e só é projetado depois que um cartão ou FID exato é consultado.

Na consulta individual, primeiro são lidos `A1:F2` e somente `A3:A`. Se houver exatamente um FID
correspondente, o servidor relê `A3:A` e busca `A:F` daquela linha. O FID e a
unicidade precisam permanecer iguais antes da projeção de B:F. O intervalo aberto
evita falso `não encontrado` quando a planilha crescer; limites de linhas, bytes e
schema convertem excesso em indisponibilidade.

## Modelo de acesso

- A rota, a visão gerencial e suas Server Actions exigem papel `master` ou
  `admin`, além da permissão efetiva. Coordenador e perfis Imob continuam
  negados mesmo quando possuem a mesma permissão usada pelo Canal de Parcerias.
- O navegador não recebe o CSV nem a URL da consulta. A visão gerencial recebe
  somente A:E; o motivo da coluna F é devolvido apenas para o FID selecionado.
- Essa autorização protege o fluxo do CRM, mas não privatiza a fonte. Enquanto o
  compartilhamento público existir, pessoas com acesso ao endereço da planilha
  podem consultá-la fora do CRM.
- O risco residual foi mantido por decisão do responsável. Tornar a planilha
  privada no futuro exige trocar o adapter e reintroduzir autenticação server-only
  antes da mudança de compartilhamento, ou a consulta falhará como indisponível.

## Contrato de segurança

- Rota: `/app/repasse`, filha do Dashboard na navegação autorizada.
- Papel `master` ou `admin` e permissão `crm.partnerships.view` são exigidos em
  conjunto no Proxy, na página, na navegação e nas Server Actions. A permissão
  isolada de Parcerias não libera esta jornada.
- O gate de release também é revalidado na Server Action antes da autorização e
  de qualquer acesso à origem.
- Entrada: somente 1 a 12 dígitos; o valor nunca compõe a URL de destino.
- Origem, planilha, aba e parâmetros são constantes server-only; redirects são
  rejeitados.
- Consulta sem cache, timeout de 8 segundos e corpo limitado a 200.000 bytes por
  leitura.
- O CSV aceita valores escapados, mas rejeita formato malformado, NUL, mais de seis
  colunas ou mais de 50.000 linhas.
- Os cabeçalhos `A2:F2` precisam corresponder exatamente ao contrato; mudança ou
  reordenação falha fechada antes de projetar qualquer registro.
- A primeira leitura recebe apenas metadados e FIDs. Zero correspondências é
  `não encontrado`; duas ou mais indicam conflito e bloqueiam a leitura das
  colunas pessoais.
- O navegador recebe apenas o DTO do registro exato. Erros externos viram mensagem
  recuperável sem detalhes da fonte.
- O quadro classifica `REPASSADO` como verde, desistência/distrato como vermelho,
  duração textual explicitamente superior a 20 dias como laranja e os demais
  estados como pendência amarela. A fonte atual não possui data individual de
  início; por isso o CRM não calcula prazo a partir da data global nem inventa
  registros laranja.
- FID, nome de cliente, motivo e conteúdo real da resposta não devem aparecer em
  logs, fixtures, screenshots versionadas ou notas de conhecimento. O QA visual
  usa somente um adaptador sintético restrito a loopback.

## Estados operacionais

- `ready`: exatamente um registro validado.
- `not_found`: nenhum registro para o FID e fonte disponível.
- `source_conflict`: FID duplicado; corrigir a fonte antes de continuar.
- `unavailable`: timeout, rede, payload inválido, resposta grande ou erro Google.
- Data ausente permanece explicitamente não informada; não usar a data do servidor.

## Mudança da origem

Se a aba, as colunas ou o modelo de compartilhamento mudarem, não ajustar por
tentativa em produção. Atualizar o contrato e os testes com fixture sintética,
validar os metadados sem registrar dados pessoais e repetir os gates de publicação.
Acesso privado não possui fallback: precisa de um adapter autenticado aprovado.
