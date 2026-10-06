# Consulta de repasse por FID

## Fonte

- Planilha: `REPASSE MAP - ACOMPANHAMENTO ONLINE / REGIONAL LEANDRO LUCAS`.
- Aba: `Table 1`, `gid=798117742`.
- Colunas autorizadas para projeção: `FID`, `EMPREENDIMENTO`, `ETAPA`, `STATUS`,
  `NOME CLIENTE` e `MOTIVO`.
- A célula `A1` informa a data da última atualização exibida pela página.

A aplicação não escreve, reorganiza nem formata a planilha. A integração usa a
Google Sheets API com escopo `spreadsheets.readonly` e conta de serviço somente
no servidor. Primeiro lê `A1:F2` e apenas a coluna `A`; se houver exatamente um
FID correspondente, relê a coluna `A` e busca `A:F` daquela linha no mesmo
batch. O FID e a unicidade precisam permanecer iguais antes da projeção de B:F.
O intervalo aberto `A3:A` evita falso `não encontrado` quando a planilha crescer;
limites de linhas, bytes e schema convertem excesso em indisponibilidade.

O compartilhamento observado em 06/10/2026 ainda permitia leitura anônima do
export. Esse estado bloqueia merge e publicação. A pessoa responsável pela conta
deve remover o acesso público, compartilhar a planilha somente com a conta de
serviço destinada à aplicação e autorizar especificamente essa mudança de acesso.

## Contrato de segurança

- Rota: `/app/repasse`, filha do Dashboard na navegação autorizada.
- Permissão Master-only repetida em Proxy, página e Server Action:
  `crm.partnerships.view`.
- O gate de release também é revalidado na Server Action antes da autorização e
  de qualquer acesso à origem.
- Entrada: somente 1 a 12 dígitos; o valor nunca compõe uma URL de destino.
- Origem, planilha e aba são constantes server-only; redirects são rejeitados.
- `REPASSE_GOOGLE_SERVICE_ACCOUNT_EMAIL` e `REPASSE_GOOGLE_PRIVATE_KEY_BASE64` são
  segredos obrigatórios do runtime. Ausência, chave inválida ou falta de acesso
  falham fechado; nunca registrar seus valores ou incluí-los em imagem/artefato.
- Consulta sem cache, timeout de 8 segundos e corpo limitado durante a leitura a
  200.000 bytes.
- Os cabeçalhos `A2:F2` precisam corresponder exatamente ao contrato; mudança ou
  reordenação falha fechada antes de projetar qualquer registro.
- A primeira leitura recebe apenas metadados e FIDs. Zero correspondências é
  `não encontrado`; duas ou mais indicam conflito e bloqueiam a leitura das
  colunas pessoais.
- O navegador recebe apenas o DTO do registro exato; CSV e demais linhas não são
  enviados. Erros externos viram mensagem recuperável sem detalhes da fonte.
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

Se a aba, as colunas ou o modelo de compartilhamento mudarem, não ajustar
por tentativa em produção. Atualizar o contrato e os testes com fixture sintética,
validar uma consulta sem dados pessoais e repetir os gates de publicação. Antes de
liberar, comprovar por requisição anônima que o export deixou de responder e por
smoke autenticado que a conta de serviço enxerga somente a planilha autorizada.
