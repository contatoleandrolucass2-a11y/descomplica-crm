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
