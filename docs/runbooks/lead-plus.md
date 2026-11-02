> Estado do candidato: páginas substituídas, sessão e guards integrados, vínculo inicial provisionado com autorização específica, worker supervisionado e webhook preparados. Build, tipos, lint e testes locais aprovados; importação dos módulos do worker conferida no standalone local. Sem publicação, sem inscrição nova da Página e sem entrega real da Meta validada. As observações sobre o protótipo abaixo são o diagnóstico que orientou a implementação; os bloqueios de credenciais, segredo, revisão/CI e prova autenticada continuam pertinentes.

# DESCOMPLICA LEAD no CRM

## Escopo e estado

O destino autorizado é `https://crm.descomplicapro.com.br/app/leads`. A área Lead será substituída pelo DESCOMPLICA LEAD, mantendo a navegação e a sessão emitida pelo CRM. O domínio raiz `descomplicapro.com.br` não é o destino desta entrega.

Este documento registra requisitos de integração e publicação; não comprova que o candidato foi publicado ou que a Meta já entrega contatos. A integração atual do C2S, seus tokens, callbacks e inscrições não devem ser removidos ou substituídos. O piloto não cria equipes e distribui somente entre membros ativos explicitamente cadastrados nos perfis Admin, Superintendente e Gerente do LEAD+.

## Separação de dados e autenticação

| Responsabilidade            | Destino                                                        | Regra                                                                               |
| --------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Sessão e autorização do CRM | Supabase `hnncxuerlcsaahdxoswb`                                | Reutilizar os cookies e os guards de servidor existentes; não criar login paralelo. |
| Dados operacionais do LEAD+ | Supabase `xwtasgjnkctyxokxjykk`, schema `c2s_app`              | Usar somente a conexão operacional própria; nunca trocar `SUPABASE_URL` do CRM.     |
| Métricas do Meta Ads        | Configuração `META_ADS_*` existente                            | Preservar valores, escopos e uso atuais.                                            |
| Captação direta de contatos | Credencial própria da Página, mesmo aplicativo Meta autorizado | Separar de `META_ADS_ACCESS_TOKEN`; não enviar segredo/token ao cliente.            |

O backend original admite fallback de `LEAD_DB_*` para `SUPABASE_*`. Na integração de produção, exigir `LEAD_DB_URL` e `LEAD_DB_PROJECT_REF` explicitamente e rejeitar destino diferente de `xwtasgjnkctyxokxjykk`, evitando que um valor ausente encaminhe dados ao banco do CRM. O backend valida hostname direto `db.<project>.supabase.co` ou pooler Supabase cujo usuário termina em `.<project>`, remove opções SSL da URL e mantém `rejectUnauthorized: true`.

## Manifesto de configuração do servidor

Os nomes abaixo são referências, não valores secretos. Não copiar arquivos `.env` locais para o artefato, não imprimir senhas ou URLs de conexão completas e não colocar variáveis privadas com prefixo `NEXT_PUBLIC_`.

| Nome                      | Uso e requisito                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `LEAD_DB_URL`             | Conexão PostgreSQL exclusiva do LEAD+, injetada por mecanismo privado do servidor.                                        |
| `LEAD_DB_PROJECT_REF`     | Valor esperado `xwtasgjnkctyxokxjykk`; validar antes de abrir o pool.                                                     |
| `LEAD_DB_CA_FILE`         | Caminho de CA legível pelo usuário `node`, montada somente para leitura quando necessária. Nunca desativar validação TLS. |
| `META_APP_ID`             | Aplicativo autorizado `4588155391458285`.                                                                                 |
| `META_APP_SECRET`         | Segredo do aplicativo, somente no servidor.                                                                               |
| `META_VERIFY_TOKEN`       | Segredo próprio para verificação do callback, somente no servidor.                                                        |
| `META_PAGE_ACCESS_TOKEN`  | Credencial própria da Página, somente no servidor.                                                                        |
| `META_PAGE_IDS`           | Lista explícita de Páginas autorizadas; piloto `766369089896318`.                                                         |
| `META_GRAPH_VERSION`      | Versão validada da Graph API; preparação original `v26.0`.                                                                |
| `META_CALLBACK_URL`       | Callback HTTPS exclusivo aprovado; ainda precisa ser registrado e validado. Não substituir callback alheio.               |
| `META_REQUIRE_FORM_ROUTE` | Manter `1`, com falha controlada para formulários desconhecidos.                                                          |
| `META_FORM_ROUTES_FILE`   | Arquivo de rotas validado, sem contatos nem credenciais. Se utilizado, precisa existir na imagem/montagem de produção.    |

A implementação original também reconhece `META_ENV_FILE` e carrega `.env.meta-lead.local` do diretório de trabalho por padrão. Esse arquivo não existe automaticamente na imagem e não deve ser incluído no build. A configuração de produção deve usar injeção explícita e um arquivo de rotas aprovado, sem depender do diretório local do desenvolvedor.

`CRM_AUTH_*` era necessário para o servidor autônomo validar Bearer no protótipo. Quando integrado ao Next.js, usar os guards e o cliente Supabase de servidor do CRM; não inserir a senha do banco operacional na configuração de Auth nem criar sessão paralela. `LEAD_API_PORT` só é pertinente se houver serviço interno separado; não é necessário para chamadas internas no mesmo processo Next.js.

## Autorização e vínculo de membros

As páginas e operações do CRM já possuem permissões `crm.leads.*`, incluindo leitura, criação, edição, atribuição, importação, configuração e auditoria. O protótipo usa nomes distintos, como `leads.view`, `leads.edit.scope` e `bucket.manage`. Um usuário com acesso ao hub não deve receber automaticamente todas as operações do protótipo.

A sessão deve ser validada no servidor com aprovação, MFA, revogação e acesso à página. Cada operação deve exigir a permissão correspondente e o escopo da associação ativa do LEAD+. Não confiar em um papel fornecido pelo navegador, metadados editáveis, cabeçalhos de identidade nem na simples semelhança de nome entre os perfis dos dois sistemas.

Os papéis do CRM incluem `master`, `admin`, `coordinator`, `manager_house` e `manager_imob`; eles não equivalem automaticamente aos perfis `admin`, `superintendent`, `manager` e `broker` do LEAD+. A vinculação deve ser explícita, auditada e negada quando ausente, inativa ou ambígua. Preservar a negação de recuperação de senha incompleta e de MFA pendente.

O resolvedor de identidade original cria um recurso de usuário ativo sem papel quando não encontra correspondência. Isso não é suficiente para o piloto: a rota de formulários filtra `resources(kind='users').data.role`. Não ativar a captação esperando que o primeiro login atribua papel de master. Não criar usuários fictícios ou equipes para suprir essa ausência.

## Banco, grants e migração

As migrations originais criam o schema `c2s_app`, habilitam RLS e revogam acesso de `PUBLIC`, `anon` e `authenticated`. A migration de runtime cria o grupo `c2s_backend_scope` como `NOLOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOREPLICATION`, `NOBYPASSRLS`, concedendo apenas recursos operacionais do schema. As policies desse grupo permitem todas as linhas; os escopos de pessoas/equipes continuam sendo responsabilidade do backend autorizado.

O grupo `NOLOGIN` não transforma uma conexão administrativa em conexão de menor privilégio. Antes da publicação, confirmar que a credencial de runtime usa um login restrito associado ao grupo, não um usuário superadministrativo ou com bypass de RLS. Não conceder ao cliente acesso direto às tabelas operacionais nem alterar grants de Auth ou de outros schemas.

Não executar as migrations do banco do LEAD+ pelo fluxo de migrations do Auth/CRM. Manter história e checksum no banco operacional, comparar o estado existente e aplicar somente diferenças necessárias. Não recriar o schema já existente nem importar os leads fictícios. Backup e rollback devem separar código, configuração, associação de membros e banco.

## Execução em produção

O Compose canônico usa uma lista explícita de variáveis. Adicionar nomes ao arquivo privado do host não os injeta no contêiner automaticamente. Na inspeção de base, `compose.yaml` ainda não declarava as variáveis `LEAD_DB_*` nem as variáveis de captação direta `META_*`; `deploy/runtime/validate-runtime-env.mjs` validava apenas o runtime principal. A integração precisa incluir as variáveis e montagens necessárias, validar projeto/TLS/configuração em produção e preservar os valores atuais do CRM.

O contêiner é executado como usuário `node`, com filesystem somente leitura, `cap_drop: ALL`, `no-new-privileges`, portas limitadas ao loopback e volumes explícitos. CA, arquivo de rotas e segredos precisam ser legíveis com essas restrições. Não tornar o filesystem gravável ou publicar porta adicional para contornar arquivo ausente.

O backend original executa um worker a cada segundo no servidor autônomo. O `tick` processa até 25 itens, usa lease persistido e idempotência, mas a trava `working` é apenas local ao processo. Um Route Handler Next.js não oferece execução contínua quando não há solicitações. Não inicializar `setInterval` a cada import/request ou durante build. Para entrega que sobreviva a reinícios e funcione sem navegador aberto, definir um worker supervisionado ou agendador autenticado, com prevenção de sobreposição e encerramento limpo. O `tick` da Meta não comprova sozinho a execução automática da transferência e das notificações do Bolsão.

A API original rejeita Host fora de localhost e origens fora de uma lista de loopback. Um adaptador Next.js deve manter a verificação de origem real na borda autenticada e passar internamente apenas contexto validado. Não desativar as verificações de origem para aceitar o domínio público. CSRF, limite de corpo, idempotência e erros sanitizados precisam ser preservados.

## Webhook e coexistência com o C2S

Antes de inscrever o aplicativo do LEAD+, consultar e registrar os aplicativos inscritos na Página usando credencial autorizada. Adicionar somente a inscrição necessária e conferir que a inscrição existente do C2S permanece. Não remover aplicativos, trocar tokens ou substituir callbacks de outros consumidores.

Verificar assinatura sobre o corpo bruto, Página autorizada e IDs de formulário. Persistir o evento antes de responder HTTP 200; erro de banco não pode virar confirmação de entrega. Repetições usam o `leadgen_id` real e não criam outro lead. Formulário desconhecido ou ausência de master ativo permanece na fila/falha controlada sem distribuição global. Logs não devem conter contato, token ou payload bruto.

O recebimento `leadgen` não é prova de captura de conversas WhatsApp. A ativação depende das permissões concedidas ao token, acesso ao formulário e à Página, estado do aplicativo e exigências atuais da Meta. A evidência de permissões salvas no painel não substitui entrega real persistida.

## Critérios para publicar e declarar concluído

1. Confirmar o diff completo e as rotas substituídas, mantendo as demais áreas do CRM e removendo os atalhos de módulos já excluídos do LEAD+.
2. Validar sessão real do hospedeiro, negações de acesso, papéis e escopos; nenhuma rota de demo ou seletor de usuário deve ficar disponível em produção.
3. Executar os testes afetados e os gates obrigatórios no SHA exato; validar desktop e celular nos três temas sem vazamento de CSS para outras abas.
4. Demonstrar conexão operacional no projeto correto, RLS/grants e vínculo dos masters reais sem gravar leads de teste no remoto sem autorização específica.
5. Validar worker supervisionado, retentativa, reinício, deduplicação e fila de falhas sem navegador aberto.
6. Cumprir DEPLOY-001 e DEPLOY-002: imagem imutável, CI terminal, revisão aprovada, backup, rollback, travas compartilhadas, consulta de versão/data real no mesmo minuto e promoção por `pnpm release:production` com comparação da versão esperada.
7. Conferir versão servida, sessão real e fluxos afetados após publicar. Para Facebook, registrar uma entrega controlada autorizada, persistência no projeto operacional, atribuição a master permitido, notificação e ausência de duplicação. Reconfirmar recebimento no C2S sem alterar sua configuração.

Se as credenciais/callback da Meta ainda estiverem pendentes, reportar a publicação da interface e a ativação da captação como estados separados. Não declarar o Facebook conectado apenas porque a página renderiza ou o health retorna 200.

### Configuração privada preparada para a promoção

O Compose monta exclusivamente `/etc/descomplica-crm/secrets/lead-plus-runtime.json.prepared` em `/run/secrets/lead-plus-runtime.json`, somente leitura e sem criação automática. O launcher lê apenas a lista permitida LEAD*DB*\_ e META\_\_ da captura direta; não aceita credenciais Meta Ads nem configuração Auth/CRM nesse arquivo. A validação do runtime é repetida depois dessa leitura. O arquivo foi preparado como root:root em modo 0440, legível pelo grupo 0 já utilizado no contêiner, sem modificar production.env, sem reiniciar processos e sem ativar o LEAD+ na versão antiga. A nova imagem passa a consumi-lo somente pela promoção protegida. A origem precisa existir antes da promoção; conferir hash, permissões e backup na VPS. Não publicar os valores.

## Central de Atendimento WhatsApp oficial

A implementação independente de WhatsApp Cloud API está documentada em [Central WhatsApp](lead-plus-whatsapp.md). Não utiliza a credencial de Página da captura de formulários e não substitui o webhook Facebook existente. O módulo permanece desativado sem configuração privada e número oficial/teste; código e testes locais não comprovam recebimento real.
