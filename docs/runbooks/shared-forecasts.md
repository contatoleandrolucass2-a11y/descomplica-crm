# Previsão compartilhada

A página `/app/gestao/previsao` aparece em Gestão conforme o catálogo autorizado.
A permissão própria `crm.management.forecast.view` controla página, API e RPC.
O catálogo concede a nova permissão apenas a Master e Admin por padrão; os demais
acessos são configurados na administração existente. Editar e salvar exige também
`crm.settings.manage`, como a edição da Rotina compartilhada.

A tabela é manual e separada por final de semana, segmento e gerente. Sexta,
sábado e domingo do mesmo final de semana usam a sexta-feira como chave canônica.
House possui Amanda, Cleber, Messias, Sidnei e Stephanie; Imob possui Álvaro,
Fabricio, Gustavo, Jonathan, Richard, Thiago e Thiago TG. Geral reúne, em uma
única página somente leitura, um bloco integral para cada gerente que salvou no
período, sem fundir ou truncar estruturas customizadas.

O rascunho inicial sem fonte apresenta dez corretores genéricos e sete
empreendimentos, cada um com Previsão e Realizado. Quando ainda não existe
previsão no recorte selecionado, o servidor reutiliza a estrutura salva mais
recentemente, limpa números e plano de ação e preenche as linhas com os
corretores relacionados ao gerente no snapshot analítico vigente. Inserir coluna acrescenta um empreendimento
com os dois campos em todas as linhas existentes. Os títulos dos empreendimentos
são editáveis; a movimentação e a exclusão abrangem o par inteiro, preservando a
associação dos valores com cada corretor. Nome do corretor e Total permanecem
nas extremidades dos valores. A coluna fixa Plano de ação vem depois do Total,
aceita até 4.000 caracteres de texto livre por corretor e não participa dos
cálculos. Se a fonte não contiver o gerente, permanece somente a primeira linha
do template; sem qualquer template, Corretor 1 a Corretor 10 são usados como
rascunho genérico.

Quando o documento compartilhado contém os nove empreendimentos conhecidos,
seus títulos são apresentados nestas duas linhas: Conquista / Itaim Paulista;
Conquista / São Miguel; Terrasse / Vila Ema; Conquista / Sacomã; Alto / Liviero;
Raiz / home Clube; Conquista / Clube Butantã; Mirante Jardim / das Esmeraldas;
Empreendimentos / Riva. A normalização muda somente espaços e quebras desses
nomes conhecidos e preserva IDs, ordem e valores.

Previsão e Realizado aceitam valores não negativos, com até duas casas decimais
e nove dígitos inteiros, usando vírgula ou ponto decimal. Campo vazio contribui
com zero para a soma. O Total da linha soma Previsão e Realizado de todos os
empreendimentos; o rodapé soma cada coluna e o total geral. Não representa
percentual de atingimento ou diferença entre previsto e realizado. Os cálculos
usam centésimos inteiros para evitar resíduos de ponto flutuante e não são
armazenados como células editáveis. A lista inicial consulta somente os nomes
por gerente do snapshot analítico; métricas do dashboard não são copiadas.

Documentos antigos são adaptados em memória, preservando linhas e conteúdo.
Texto antigo em uma célula numérica permanece visível para correção; o total
afetado fica indisponível e o salvamento é bloqueado até a correção. A adaptação
é persistida somente ao usar Salvar. Não há reescrita automática de dados remotos.

Salvar envia o documento, a data selecionada, o segmento e o gerente ao CRM,
incluindo a revisão daquele recorte. Outra edição já salva no mesmo recorte gera
conflito; edições de outro gerente ou final de semana possuem revisões independentes.
O rascunho permanece e não sobrescreve a versão de outro usuário.
Recarregar com alterações exige confirmação. Falha de rede não indica sucesso.
O armazenamento compartilhado não usa localStorage.

Limites: 14 empreendimentos (30 colunas armazenadas, incluindo corretor e Plano
de ação), 200 linhas, 120 caracteres por título, 4.000 por célula e corpo limitado a
2.000.000 bytes. Os identificadores estáveis preservam as células ao mover ou
excluir um empreendimento intermediário. Documentos legados com mais pares que
o limite são preservados para ajuste explícito antes de salvar. A tela apresenta carga, vazio, erro recuperável e leitura
sem permissão de edição. Edições pendentes recebem proteção de saída.

## Banco e publicação

Aplicação desta evolução confirmada em 18/10/2026, após autorização explícita
para a migration e recuperação da função anterior. O arquivo local
`20261018142142_crm_forecast_groups.sql` corresponde ao histórico remoto
`20261018232900 / crm_forecast_groups`. Publicação em eeb42a45 confirmada pelo
coordenador às23:29:19Z. Evidências, hashes e limites em ATUALIZACOES.md.
Esta aplicação concluída não autoriza migrations futuras.

A evolução Calendário e Plano de ação prepara a migration
`20261019004204_forecast_action_plan.sql`. Ela substitui somente a validação da
RPC de salvamento: exige Plano de ação como última coluna, preserva os pares
Previsão/Realizado como números e permite texto livre apenas no corretor e no
Plano de ação. Não reescreve documentos existentes, não muda ACL, RLS, owner,
assinatura, autorização, auditoria ou controle de revisão. Documentos agrupados
anteriores recebem a coluna vazia apenas em memória e só são persistidos por um
salvamento explícito. A migration não foi aplicada remotamente e requer nova
autorização específica após CI e restauração isolada aprovadas.

A evolução por período prepara também a migration aditiva
`20261020122216_forecast_period_scopes.sql`. Ela cria
`crm_forecast_periods`, `get_crm_forecast_period` e
`save_crm_forecast_period`, com chave por sexta-feira, segmento e gerente. A
tabela usa RLS forçada e não concede acesso direto aos papéis da Data API; as
RPCs repetem identidade, conta ativa, MFA, página, permissão de edição e CAS.
O singleton legado permanece intacto e pode fornecer apenas o primeiro template
limpo. A auditoria armazena período, recorte, revisão e contagens, sem conteúdo
das células. Geral retorna seções completas e nunca aceita escrita. Esta
migration também não foi aplicada remotamente e exige autorização específica.

A lista automática usa a migration
`20261020204500_forecast_broker_roster.sql`. Ela cria somente a RPC de leitura
`get_crm_forecast_brokers`, sem alterar snapshots, usuários ou previsões. A RPC
repete os guards de identidade, conta ativa, página e permissão, escolhe a visão
House/Imob correspondente e retorna até 200 nomes distintos do snapshot mais
recente. O acesso direto às tabelas analíticas continua revogado. A migration
corretiva `20261020214500_forecast_broker_manager_accents.sql` normaliza
diacríticos na comparação do gerente, cobrindo nomes como Álvaro, Fabrício e
Thiago de Araújo sem exigir extensão adicional do Postgres. A primeira migration
foi aplicada em produção; a corretiva exige autorização específica após a CI.

A versão anterior da RPC singleton rejeita o documento novo com número par de
colunas. O runtime por período usa RPCs novas e não depende dessa assinatura
para salvar. Na publicação, aplicar as migrations autorizadas na ordem
versionada antes da promoção da imagem. Em recuperação, preservar
`crm_forecast_periods` e seus dados; reativar a imagem anterior não exige apagar
os recortes novos, que permanecem inacessíveis ao runtime antigo.

A migration `20261018142142_crm_forecast_groups.sql` substitui apenas a validação
da RPC de salvamento para exigir pares completos e números também no banco.
Mantém assinatura, owner, ACL, RLS, autorização e controle de revisão. Não altera
registros existentes nem a RPC de leitura. A autorização anterior de criação do
armazenamento não abrange esta nova aplicação remota: obter autorização específica
após validação da migration e dos 36 testes novos, além dos 61 testes originais.

Na publicação desta evolução, preservar a definição anterior da RPC e conferir
seu hash, owner, ACL e configurações imediatamente antes da aplicação. A versão
anterior do editor envia documentos legados; após a migration esses envios são
rejeitados. Aplicar a migration somente com o novo artefato já validado e pronto
para promoção. Em rollback do editor, restaurar primeiro a função anterior sob
a autorização de recuperação correspondente; não apagar a tabela nem reverter
as previsões salvas. A imagem anterior consegue ler o JSON agrupado, mas não
oferece a nova apresentação e pode editar os pares separadamente.

As migrations desta entrega criam somente o armazenamento da previsão e suas
RPCs e sincronizam o catálogo versionado. O usuário autorizou explicitamente
essa aplicação aditiva após validação em 16/10/2026. Não aplicar outras migrations
pendentes nem alterar permissões de outras páginas além da sincronização revisada.

Antes de aplicar, confirmar projeto pelo Supabase URL do runtime e identidade do
projeto, conferir CI completa com pgTAP e preservar backup privado de catálogo,
ACL e histórico afetados. Conferir ausência dos novos objetos ou sua definição.
A tabela tem RLS forçada e não permite acesso direto pelos papéis da Data API;
RPCs repetem identidade, conta ativa, MFA e acesso efetivo à página. A auditoria
guarda metadados, sem copiar nomes ou conteúdo das células.

O runtime anterior não conhece a permissão nova. Aplicar o armazenamento aditivo
antes da promoção; sincronizar o catálogo com a imagem compatível e verificar
acesso, sem deixar a imagem anterior interpretar uma permissão desconhecida.
Rollback de aplicação preserva a tabela e seus dados; não usar DROP ou excluir
previsões para reverter. Publicar pelo coordenador `release:production`, com
CI/main exatos, imagem imutável, consulta e CAS no minuto da troca.

Validação: `tests/forecasts.test.ts`, `tests/forecast-api.test.ts`,
`tests/forecast-settings.test.tsx`, `supabase/tests/crm_forecasts.test.sql`,
catálogo, recursos e gates globais. A CI executa o fluxo de navegador sintético
com `FORECAST_SETTINGS_BROWSER=1`; nunca inserir fixtures no banco de produção.

## Apresentação visual

A Previsão reutiliza o canvas e os tokens do dashboard /app nos temas Claro,
Médio e Escuro. Cabeçalho, separadores, superfícies e botão Salvar seguem a mesma
linguagem. A tabela usa rolagem horizontal própria no desktop e no celular para
preservar os pares em linha única. A coluna do corretor, inclusive cabeçalho,
linhas e Total geral, permanece fixa durante essa rolagem. Os números de linha
não quebram em múltiplas linhas. A coluna do corretor é compacta e os nomes dos
empreendimentos ocupam no máximo duas linhas, todos com a mesma largura. Plano de
ação ajusta sua largura ao texto dentro dos limites da tabela. Cabeçalhos
Previsão/Realizado e linhas de dados usam 22 px. Foco e passagem do mouse
destacam juntos a célula, o corretor, Previsão ou Realizado e o respectivo
empreendimento. Os controles compactos de reordenação e exclusão ficam junto às
bordas superiores do grupo sem deslocar ou cobrir o título.
Os campos têm alinhamento vertical centralizado; o nome do corretor fica
alinhado à direita, mantendo a ordem natural das letras em português. Edição,
confirmação de exclusão, rascunho e controle de revisão permanecem iguais.

O título informa o intervalo no formato `Previsão Final de semana dia
dd/mm/aaaa até dd/mm/aaaa`. Os botões Geral, House e Imob e os gerentes mudam o
recorte; uma troca com rascunho exige confirmação de descarte.

O botão Calendário abre um diálogo mensal acessível, 30% menor que a primeira
versão. Somente sexta-feira, sábado e domingo recebem destaque e entram em Total,
Passados e Restantes; a interface os chama sempre de dias validados. A seleção de
mês e ano e o clique em um dia validado carregam o recorte correspondente sem
fechar o diálogo. O dia escolhido permanece identificado. Escape ou o botão
Fechar encerram o diálogo e devolvem o foco ao botão Calendário.
