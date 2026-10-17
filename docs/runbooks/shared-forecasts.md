# Previsão compartilhada

A página `/app/gestao/previsao` aparece em Gestão conforme o catálogo autorizado.
A permissão própria `crm.management.forecast.view` controla página, API e RPC.
O catálogo concede a nova permissão apenas a Master e Admin por padrão; os demais
acessos são configurados na administração existente. Editar e salvar exige também
`crm.settings.manage`, como a edição da Rotina compartilhada.

A tabela é global e manual. Começa com Nome do corretor, Previsão e Realizado,
com título de equipe editável. É possível editar cabeçalhos e células e incluir
ou excluir linhas e colunas. Os valores são texto livre; não há cálculo financeiro,
integração com ranking nem preenchimento automático. Nenhum nome do print é seed.

Salvar envia o documento ao CRM, incluindo sua revisão. Outra edição já salva
gera conflito; o rascunho permanece e não sobrescreve a versão de outro usuário.
Recarregar com alterações exige confirmação. Falha de rede não indica sucesso.
O armazenamento compartilhado não usa localStorage.

Limites: 30 colunas, 200 linhas, 4.000 caracteres por célula e corpo limitado a
2.000.000 bytes. Os identificadores estáveis preservam as células ao excluir uma
coluna intermediária. A tela apresenta carga, vazio, erro recuperável e leitura
sem permissão de edição. Edições pendentes recebem proteção de saída.

## Banco e publicação

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
