# Dimensões livres dos cards de Agendamentos

## Contrato

Somente `crm.stage.appointments` aceita largura em pixels (`layout.width`,
opcional, inteiro de 128 a 16384) e altura inteira de 72 a 16384 pixels.
O mínimo de largura acomoda os controles compactos. A largura visível fica
limitada ao espaço disponível; o valor salvo é preservado ao mudar de tela.
Cards antigos sem `width` continuam usando o span de 1 a 12 colunas.

O layout de Agendamentos usa flex-wrap: cada card pode ter largura e altura
próprias, com quebra de linha, sem sobreposição. Arrastar o canto ajusta os
dois eixos; as setas ajustam um pixel, ou dez com Shift. O editor permite
informar os valores. Mover, editar, selecionar e desfazer preservam as dimensões.
As outras páginas mantêm o layout e os limites anteriores.

Ao confirmar o editor de Agendamentos, a gravação é enviada imediatamente,
sem a espera do autosave. O editor mostra `Salvando…`, bloqueia alterações
durante a requisição e fecha somente após a confirmação do servidor. Uma
gravação anterior em andamento é concluída antes de enviar a versão seguinte.
Erro ou conflito real mantém o editor e os valores; não apresenta sucesso falso.
Em conflito de versão, edições independentes de tamanho e ordem são combinadas
sobre o perfil remoto e reenviadas uma vez com a versão atual. Conflitos no
mesmo campo bloqueiam a gravação até recarregar o perfil salvo.
Arraste e teclado mantêm autosave, indicando pendência desde a alteração.

O conflito de aplicação de Agendamentos usa SQLSTATE `PGRST`, com corpo JSON
compatível (`code: 40001`) e DETAIL `{"status":409,"headers":{}}`. O campo
`headers` é obrigatório no parser do PostgREST 14, mesmo vazio. Usar SQLSTATE
`40001` diretamente causa repetição transacional e impede o cliente de receber
o conflito. A migration `20261031055824_appointments_profile_conflict_http.sql`
preserva CAS, ACL, validações e perfis existentes; sua aplicação remota exige
autorização específica e CI aprovada. A aplicação publicada permanece compatível.

Regressão focada: `node scripts/qa/appointments-preview.mjs --first-save-only`.
O fixture local cobre confirmação única com refresh imediato, resposta retida,
fila com versões consecutivas, erro recuperável e conflito. Os resultados ficam
em `test-results/appointments-first-save/`, sem dados reais. Essa prova não
substitui o teste autenticado após publicar o artefato aprovado.

O cabeçalho duplicado é removido. Ícones compactos aparecem em hover/foco;
em toque, mover e um ícone de ações mantêm alvos de 44 px; o menu abre o editor de dimensões fora do card. O controle de acesso
existente ao editor permanece vigente.

## Altura máxima das torres em pixels

Em Agendamentos, o campo direto no gráfico aceita `presentation.barMaxHeight`,
um inteiro positivo em pixels. O campo não usa a faixa de 50% a 150% nem altera
`layout.width`, `layout.height`, span ou ordem. Não há teto de produto em pixels;
o contrato só exige inteiro seguro de JavaScript. Campo vazio restaura a escala
automática, removendo também o percentual legado daquele gráfico.

O limite é aplicado à maior torre real e mantém uma escala comum para todas as
torres, metas e rótulos. O espaço interno disponível continua sendo o limite
físico: um valor maior não aumenta o card nem corta cada torre individualmente.
Perfis antigos com `barScale` preservam a aparência até alterar explicitamente
o campo de altura; editar só título ou cor não migra esse ajuste. O novo limite
em pixels tem precedência quando presente. O popup dedicado foi removido:
Enter ou saída do campo confirma; arrastar a linha superior confirma ao soltar.
Escape descarta o rascunho. O estado de gravação continua acessível no painel.

A linha superior acompanha o maior realizado do recorte. As sete linhas de
grade foram removidas. A meta usa um único caminho pontilhado conectado entre
os períodos conhecidos, recalculado pelo filtro; ausências não viram zero.
Metas acima da área disponível são sinalizadas, preservando seus valores.
Essas regras valem para os gráficos diários, semanais e mensais.

A migration `20261031184038_appointments_bar_max_height_pixels.sql` expande
somente a validação de Agendamentos, sem reescrever documentos, mudar permissões,
RLS, CAS ou o conflito HTTP 409. Aplicar o DDL aprovado antes de publicar a
interface. A autorização de migrations anteriores não cobre essa expansão.

Antes da primeira gravação com `barMaxHeight`, o validador e a aplicação anteriores
podem ser restaurados sem conversão. Depois de gravar o campo novo, uma imagem
antiga com schema estrito rejeita esses perfis: corrigir com versão compatível,
preservando o campo. Não remover o limite salvo nem converter dados durante
rollback sem plano e autorização específicos.

## Cópias, controles e sidebar

As ações compactas de cada card oferecem copiar, adicionar do zero e abrir as
ferramentas do painel. Hover e foco revelam os ícones; toque mantém menu com
alvos acessíveis. Organizar, histórico e PDF continuam nas ferramentas, sem
a faixa permanente. Títulos de rankings, conversões e recência ficam visíveis.

Copiar gera ID novo e insere depois da origem, preservando apresentação,
dimensões e conteúdo. A cópia pode ser editada independentemente. Somente
Agendamentos permite repetir métrica e tipo; os IDs seguem únicos e o limite
permanece em 50 cards. A migration
`20261101115602_appointments_allow_card_copies.sql` altera apenas essa restrição
no validador privado v2, sem reescrever perfis ou mudar RLS, grants, CAS ou RPC.
Sua aplicação remota exige autorização específica e CI verde. Após salvar
cópias, rollback requer leitores e validador compatíveis; não deduplicar dados.

Sidebar de 44/136 px, gutters e gaps de 8 px são específicos de Agendamentos.
No desktop, a abertura reduz proporcionalmente a superfície com largura virtual
estável, preservando linhas e ordem; até 760 px, o menu abre sobreposto.
Nenhuma abertura de sidebar regrava dimensões ou ordem dos cards.

## Publicação e autorização

A migration `20261029210251_appointments_free_card_dimensions.sql` é necessária
antes de publicar esta interface. Ela acrescenta um validador privado para
Agendamentos e preserva o validador anterior, RPCs, catálogo, apresentação,
autorização, RLS e comparação de versão. Não reescreve os perfis existentes.
O documento continua na versão 2, com campo novo opcional; isso permite ler
os cards antigos, mas não garante que uma aplicação antiga leia cards novos.

Aplicar a migration remotamente exige autorização específica conforme AGENTS.md;
a autorização permanente de deploy da aplicação não cobre migrations remotas.
Antes dessa autorização e dos gates da CI isolada, manter a entrega pendente.
Não publicar a interface contra o validador antigo, que rejeitaria `width`
e dimensões menores. Não instalar ferramentas nem acessar dados privados
para contornar um gate indisponível.

Após autorização: confirmar ambiente, cadeia de migrations e backup aplicável;
aplicar somente a migration revisada pelo procedimento autorizado; verificar
funções e metadados sem expor registros de usuários; publicar o artefato
imutável aprovado com `pnpm release:production`, preservando DEPLOY-001/002.
Conferir health, versão e a jornada autorizada de salvar/reabrir dimensões.

## Validação e rollback

Vitest cobre normalização, edição, autosave, histórico, limites e isolamento
por página. Os pgTAP cobrem o validador e a preservação das dimensões na RPC,
incluindo rejeições e ACL. A execução de SQL depende do banco isolado da CI
quando Docker/psql não estiverem disponíveis localmente.

O preview Chromium usa fixtures e endpoint de perfis sintéticos em memória.
Ele comprova interação e transporte do documento no fixture; não comprova
gravação em produção nem o CSS do build Next. A CI mantém os gates reais.

Antes de qualquer novo perfil com `width`, a reversão de DDL pode restaurar
o validador preservado e a imagem anterior sem converter dados. Depois de
gravações novas, não promover a imagem antiga: seu schema rejeita `width`
e dimensões abaixo dos mínimos anteriores. Preferir uma imagem de correção
compatível com os perfis novos. Uma recuperação de backup ou conversão de
layouts requer plano revisado, backup dos documentos originais e autorização
específica para mutação de dados. Não remover `width`, reduzir dimensões ou
restaurar dados automaticamente durante rollback.
