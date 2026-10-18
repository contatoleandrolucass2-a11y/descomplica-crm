# Previsão compartilhada

A página `/app/gestao/previsao` aparece em Gestão conforme o catálogo autorizado.
A permissão própria `crm.management.forecast.view` controla página, API e RPC.
O catálogo concede a nova permissão apenas a Master e Admin por padrão; os demais
acessos são configurados na administração existente. Editar e salvar exige também
`crm.settings.manage`, como a edição da Rotina compartilhada.

A tabela é global e manual. Começa com Nome do corretor e sete empreendimentos,
cada um com Previsão e Realizado. Inserir coluna acrescenta um empreendimento
com os dois campos em todas as linhas existentes. Os títulos dos empreendimentos
são editáveis; a movimentação e a exclusão abrangem o par inteiro, preservando a
associação dos valores com cada corretor. Nome do corretor e Total permanecem
nas extremidades. Os nomes iniciais Corretor 1 e Corretor 2 são rascunhos genéricos,
não cadastros ou dados importados de clientes.

Previsão e Realizado aceitam valores não negativos, com até duas casas decimais
e nove dígitos inteiros, usando vírgula ou ponto decimal. Campo vazio contribui
com zero para a soma. O Total da linha soma Previsão e Realizado de todos os
empreendimentos; o rodapé soma cada coluna e o total geral. Não representa
percentual de atingimento ou diferença entre previsto e realizado. Os cálculos
usam centésimos inteiros para evitar resíduos de ponto flutuante e não são
armazenados como células editáveis. Não há integração com ranking.

Documentos antigos são adaptados em memória, preservando linhas e conteúdo.
Texto antigo em uma célula numérica permanece visível para correção; o total
afetado fica indisponível e o salvamento é bloqueado até a correção. A adaptação
é persistida somente ao usar Salvar. Não há reescrita automática de dados remotos.

Salvar envia o documento ao CRM, incluindo sua revisão. Outra edição já salva
gera conflito; o rascunho permanece e não sobrescreve a versão de outro usuário.
Recarregar com alterações exige confirmação. Falha de rede não indica sucesso.
O armazenamento compartilhado não usa localStorage.

Limites: 14 empreendimentos (29 colunas armazenadas, incluindo o corretor), 200
linhas, 120 caracteres por título, 4.000 por nome de corretor e corpo limitado a
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
linguagem. A tabela distribui os empreendimentos na largura disponível no desktop.
No celular, a apresentação adapta os grupos sem exigir rolagem horizontal.
Os campos têm alinhamento vertical centralizado; o nome do corretor fica
alinhado à direita, mantendo a ordem natural das letras em português. Edição,
confirmação de exclusão, rascunho e controle de revisão permanecem iguais.
