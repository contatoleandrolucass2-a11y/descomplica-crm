# Central de Atendimento do LEAD+ com WhatsApp Cloud API

## Estado e limites da entrega

Implementação em branch isolada, com prévia e testes locais. O usuário informou que ainda não possui número/WABA em 01/11/2026. Nenhuma conta, número ou permissão WhatsApp foi criada na Meta; nenhum token da Página/Facebook ou do Meta Ads foi reutilizado para enviar mensagens. Nenhuma migration ou mensagem de teste foi executada no Supabase remoto. A entrega não comprova conexão em produção nem satisfaz ainda o aceite de envio/recebimento real com conta oficial de teste.

A prévia local usa dados fictícios somente em memória, com aviso visível. Não é um backend conectado. Para ativação real ainda são necessários número oficial ou de teste, WABA, Phone Number ID, credencial dedicada, permissões aplicáveis, inscrição do webhook, migration operacional e publicação protegida da imagem aprovada.

## Arquitetura reaproveitada

- Frontend React/Next.js existente, identidade DESCOMPLICA LEAD e três temas. A central é uma tela interna do workspace existente, com lista, chat e informações do lead; no celular, as áreas são alternadas por guias.
- Backend Node.js por Route Handlers Next.js e adaptador autenticado `/app/leads/backend/whatsapp/*`.
- A sessão e os guards de aprovação, MFA, páginas e permissões continuam pertencendo ao CRM no projeto `hnncxuerlcsaahdxoswb`. Não há login paralelo.
- Dados no projeto operacional separado `xwtasgjnkctyxokxjykk`, schema privado `c2s_app`. Contatos e leads existentes são reaproveitados quando a identidade da organização é comprovada. Os campos legados não provam multitenancy; esta instalação exige uma única organização vinculada pelo servidor. Nenhum identificador de organização do navegador é aceito como autoridade.
- Filas e outbox no PostgreSQL, com transações, chaves de unicidade, leases, limite de tentativas e worker já supervisionado pelo launcher. Nenhum serviço ou pacote novo foi adicionado.
- Atualização próxima de tempo real por cursor persistente e polling autenticado a cada dois segundos, com recuo até quinze segundos em falhas. Não é WebSocket nem acesso direto às tabelas via Supabase Realtime. Transferências sinalizam ressincronização sem expor dados agora inacessíveis.
- Notificações de mensagens/conversas usam somente metadados autorizados, com popup e o som já configurado no LEAD+. O primeiro cursor ignora o histórico para não notificar mensagens antigas.
- CSS próprio `wa-*`, carregado dentro do Shadow DOM existente. Não usar CSS Modules no documento externo para essa superfície.

## Configuração segura

O arquivo privado já montado do LEAD+ aceita estes nomes adicionais, todos exclusivos do servidor:

| Variável                   | Finalidade                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| `WHATSAPP_ORGANIZATION_ID` | Organização única desta instalação; obrigatória para ativar o módulo.                          |
| `WHATSAPP_CREDENTIAL_KEY`  | Chave aleatória de 32 bytes em base64 canônico; criptografia AES-256-GCM.                      |
| `WHATSAPP_APP_ID`          | Aplicativo autorizado; pode usar o `META_APP_ID` existente como referência se for o mesmo app. |
| `WHATSAPP_APP_SECRET`      | Segredo do aplicativo; pode usar o `META_APP_SECRET` existente se o mesmo app for confirmado.  |

A chave de criptografia não pode ser gerada no frontend, versionada, impressa nem perdida. Preservar backup privado e plano de recuperação. Alterar configuração de runtime exige o procedimento protegido aplicável; esta entrega não acrescenta uma rota pública para escrever arquivos de segredos.

O Admin, sem visualização de outro usuário, configura metadados, token de acesso e Verify Token na área WhatsApp Business. Os dois tokens são somente escrita: criptografados com contexto organização/conta, nunca retornados por APIs, logs ou listas. Para edição, campos secretos vazios preservam os valores anteriores. O App ID deve coincidir com a configuração segura do servidor. WABA, número e aplicativo de uma conta existente são imutáveis; outro número cria uma nova conta, preservando o histórico.

Salvar deixa o número desativado até validação. A validação consulta a Meta por leitura, confirma a pertença do Phone Number ID ao WABA e habilita o processamento local. Isso não inscreve automaticamente o aplicativo nem comprova chegada de mensagens. Desativar impede uso no LEAD+, sem excluir número, WABA ou inscrições na Meta.

## Migration isolada

A migration `lib/crm/lead-plus/server/migrations/20261102013756_lead_whatsapp_central.sql` foi gerada pelo Supabase CLI em configuração temporária separada. Não colocá-la no pipeline de migrations do Auth/CRM.

Cria dez tabelas ausentes: contas, mapeamento de contatos, conversas, mensagens, histórico de responsáveis, notas internas, eventos de webhook, alterações, disponibilidade e leituras. Habilita RLS e revoga acesso público, `anon`, `authenticated` e `service_role`. Somente o grupo operacional restrito já existente recebe os grants necessários; os escopos de usuário são validados pelo backend. O teste PostgreSQL usa um login sem BYPASSRLS.

`scripts/lead-plus/whatsapp-schema.mjs --check` verifica presença e RLS sem gravação. `--apply` exige configuração de destino explícita e `LEAD_WHATSAPP_MIGRATION_APPROVED=1`, além da autorização operacional real. Rejeita o projeto de Auth/CRM, schema parcial e checksum divergente; usa lock transacional e ledger no schema operacional. Não imprimir URL de banco ou segredos. Antes de aplicar remotamente, registrar backup, destino e checksum. O rollback da aplicação mantém as tabelas e dados; não executar DROP como rollback automático.

## Recepção e processamento

Endpoint HTTPS público: `GET/POST /api/integrations/whatsapp/webhook`.

GET aceita apenas modo subscribe e Verify Token correspondente a uma conta privada. POST limita o corpo, confere HMAC-SHA256 sobre os bytes originais antes de interpretar JSON, filtra exatamente WABA e número habilitados e persiste eventos antes do HTTP 200. Falha de banco devolve erro; reentregas permanecem idempotentes.

O worker identifica o contato por organização, conta/número e WhatsApp ID. Uma conversa ativa é reutilizada; mensagens adicionais não criam outro lead. Após encerramento, nova mensagem cria outra conversa/lead, preservando o contato autorizado. Timestamps de cliente avançam pelo maior valor, sem retroceder com eventos fora de ordem. Status que chegam antes da confirmação de envio permanecem em retentativa; leitura/entrega não são rebaixadas por eventos antigos.

Origens de clique para WhatsApp usam apenas os metadados presentes no webhook. Ausência de campanha permanece desconhecida. A captura de formulários instantâneos Facebook já existente continua independente e respeitando sua seleção de campanhas. Nenhuma inscrição do C2S é removida.

## Autorização e distribuição

A organização vem exclusivamente do servidor. Cada acesso revalida o membro ativo. Admin e Superintendente possuem escopo global somente dentro dessa organização; Gerente supervisiona sua equipe não vazia; Corretor vê sua fila permitida e seus atendimentos. A falta de equipe não concede alcance global. A autorização operacional é intersectada com os grants canônicos do CRM e, em visualização de outro usuário, com ambos os usuários. Configuração/exportação de privacidade exigem Admin real e não admitem impersonação.

- Leitura: página canônica de lista de leads.
- Resposta/mídia: `crm.leads.messages.manage` e conversa ativa atribuída ao usuário efetivo.
- Assumir/transferir: grants de atribuição e distribuição, com escopo de destino.
- Dados comerciais: edição e movimentação de etapa; venda exige confirmação explícita.
- Configuração: `crm.leads.settings.manage`, perfil Admin real.
- Relatórios/exportação: grants próprios existentes do CRM.

Fila compartilhada é o padrão. Modos automático e manual são configurados por número. Claim, transferência e limites simultâneos são transacionais, com versão e lock comum por organização; duas tentativas concorrentes não recebem a mesma conversa nem excedem o limite por disputa entre números. O modo automático usa somente disponibilidade explícita renovada em até cinco minutos. A central renova a disponibilidade a cada dois minutos enquanto aberta; o backend continua validando permissões em toda operação. Não são criados usuários ou equipes.

Leads WhatsApp não são resgatados pelo Bolsão de formulários. A troca de responsável desses leads é feita pela central, evitando duas autoridades conflitantes para a conversa. O editor geral mantém suas demais funções. Auditoria preserva o ator autenticado real e o usuário efetivo.

## Envio, mídia e falhas

O envio é feito somente pela Cloud API, nunca WhatsApp Web, QR Code ou intermediário. O backend valida conteúdo, propriedade, janela e grants antes de persistir a outbox. A tentativa usa UUID do cliente, hash do conteúdo e reserva transacional. O envio usa o conteúdo e a credencial da reserva persistida, não uma nova versão do corpo HTTP com o mesmo UUID.

Mensagens livres exigem menos de 24 horas desde a última mensagem recebida do cliente, nunca desde uma mensagem enviada pela empresa. Após expiração, apenas templates aprovados e reconsultados são permitidos. Não se presume gratuidade. Suporte inicial de templates: corpo de texto com variáveis numéricas contíguas; cabeçalho/botões e variáveis nomeadas são recusados explicitamente.

Texto, imagens, documentos e áudio usam IDs oficiais de mídia. Upload possui limites por MIME e teto da aplicação; imagem até 5 MiB. Download exige autorização da conversa e credencial do servidor, origem Meta permitida, ausência de redirects, limite e integridade. O navegador recebe somente bytes autorizados e cria Blob local revogado ao sair. Não há URL pública contendo token.

O envio inicial é síncrono dentro da requisição autenticada, com persistência anterior à chamada Meta. O worker não envia automaticamente em nome de um usuário com permissões potencialmente revogadas. Tentativa recusada de forma inequívoca pode ser repetida pelo operador com o mesmo identificador, até três tentativas. Timeout/resposta ambígua vira estado sem confirmação e não é reenviado automaticamente, evitando duplicação. Reinício recupera leases de entrada e sinaliza tentativas incertas de saída. Reconciliação incerta sem identificador Meta pode exigir intervenção; não se promete entrega exatamente uma vez pela API externa.

## Indicadores e privacidade

Relatórios usam apenas conversas no escopo autorizado, com filtros de período, responsável, equipe, origem, campanha e status. Campanha desconhecida não é inventada. Taxa de conversão usa a etapa comercial real 5 do lead; médias ausentes são nulas.

Notas internas não são enviadas à Meta. A retenção configurável remove conteúdo e anexos locais de conversas encerradas após o prazo, em lotes limitados no worker. Não exclui o número, mídias remotas na Meta, contatos compartilhados, auditoria ou chaves de deduplicação. Exportação administrativa é paginada e sinaliza se o histórico está completo. O endpoint de redação exige Admin real, conversa encerrada, versão e confirmação textual explícita; não foi executado remotamente.

Isso não equivale à exclusão integral de um titular. Solicitações envolvendo contatos reaproveitados por outros módulos, backups e dados existentes na Meta precisam de análise e execução coordenada. Revisão jurídica e política de retenção da organização permanecem pendentes; nenhum texto foi declarado juridicamente aprovado.

## Validação e ativação pendentes

Testes locais cobrem HMAC, número/WABA, identidade, duplicidade, concorrência, transferências, perda de acesso, fechamento/reabertura, janelas, templates, falhas e retomada de leases. A suíte PostgreSQL cria e remove seu próprio banco e login locais; não lê credenciais remotas. A prévia usa os mesmos componentes e arquivos CSS da aplicação, com fixtures claramente identificadas.

Ainda faltam: revisão/CI/publicação do candidato, aplicação autorizada da migration operacional, configuração privada, permissões e inscrição oficial de um número de teste ou comercial, e prova de uma mensagem real recebida, assumida, respondida e persistida. Não chamar o módulo de conectado em produção antes dessas evidências.

Referências consultadas em 01/11/2026: documentação oficial Meta no Postman, https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api e https://www.postman.com/meta/whatsapp-business-platform/folder/o48mro7/messages . Os links developers.facebook.com consultados retornaram 429; não se alega leitura integral. Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security ; changelog consultado antes do desenvolvimento.
