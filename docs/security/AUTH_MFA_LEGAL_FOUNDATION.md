# Fundação de autenticação, MFA e consentimentos legais

## Estado e limites deste incremento

Esta fundação foi implementada e validada somente no ambiente local. A migration
`20260824230058_auth_mfa_legal_foundation.sql` ainda não foi aplicada em ambiente
remoto. Nenhum usuário, fator, sessão, grant ou dado de homologação ou produção foi
alterado.

Ela adiciona recuperação de senha, MFA TOTP, duração explícita da sessão, consentimento
de cookies, documentos legais versionados e um ledger privado de aceites. Não ativa
integrações, read model v3, relay, motores ou políticas comerciais.

## Recuperação de senha

1. `/esqueci-senha` aceita um e-mail e sempre devolve a mesma mensagem genérica,
   independentemente da existência ou elegibilidade da conta.
2. O servidor chama `resetPasswordForEmail` somente após validar a entrada e resolver
   um callback fixo a partir de `APP_ORIGIN`. Nenhum host, protocolo ou caminho vindo da
   requisição é usado para construir o callback.
3. O template próprio de recovery monta diretamente `/auth/callback` com o `TokenHash`.
   O callback aceita somente SHA-224 em 56 caracteres hexadecimais, puro no fluxo
   implícito ou com o prefixo oficial `pkce_`, e `type=recovery`; verifica por
   `verifyOtp` via POST/body e nunca envia o hash em uma query ao gateway do Auth.
   Em projeto hospedado que ainda usa o template padrão `ConfirmationURL`, o callback
   também aceita exclusivamente o auth code UUID v4 emitido pelo fluxo PKCE atual e
   o troca por sessão com `exchangeCodeForSession`. O retorno precisa declarar
   `redirectType=recovery`; em ambos os contratos, a sessão só prossegue quando as
   claims confirmam método de recuperação recente. Códigos de login, magic link ou
   OAuth não entram no fluxo de redefinição.
   A sessão resultante é temporária, exige AMR estruturado `otp` (emitido pelo
   `verifyOtp` atual) ou `recovery` compatível, aplica `no-store` e envia
   `Referrer-Policy: no-referrer`. Esses métodos ficam em quarentena no SSR, APIs,
   RPCs e RLS; login por senha não é confundido com recuperação.
   Hash inválido não encerra nem rebaixa uma sessão legítima já aberta; marker e
   cookies só mudam depois da verificação bem-sucedida.
4. `/redefinir-senha` exige uma sessão de recuperação viva e AMR `otp`/`recovery`
   estruturado com timestamp de no máximo 15 minutos. A senha deve ter entre 12 e 128
   caracteres e conter maiúscula, minúscula, número e símbolo.
5. Após a alteração, a RPC
   `revoke_current_user_sessions_after_password_recovery` remove todas as sessões do
   usuário. O fallback é `signOut({ scope: "global" })`; falha de ambos encerra os
   cookies locais, não declara sucesso e exige novo fluxo.

Senhas, códigos, tokens, QR Codes, chaves TOTP e cookies nunca devem ser registrados.
O proxy reverso também precisa ser verificado antes da ativação remota: parâmetros de
callback não podem permanecer em access logs nem error logs. As locations exatas do
callback suprimem ambos; isso remove detalhe de erro dessa rota, portanto saúde e falhas
agregadas devem ser acompanhadas fora da request URI.
No desenvolvimento, o Next também mantém `serverFunctions: false` para não imprimir
argumentos de Server Actions e ignora a URL do callback nos logs de requests. Recovery
com links reais deve usar o harness local em modo `next start`, sem trace, screenshot ou
saída que serialize a URL de uso único.

## `APP_ORIGIN`

`APP_ORIGIN` é a única origem autorizada para callbacks e decisões de cookie. Em
produção, deve ser uma origem HTTPS absoluta e exata, sem credenciais, caminho, query ou
fragmento. A única exceção é HTTP em host loopback exato para gates locais executados
com o build de produção, quando o launcher também define
`AUTH_LOCAL_INSECURE_LOOPBACK_QA=true` e a URL do Supabase é loopback. Sem essa
conjunção, cookies continuam `Secure` e a origem é rejeitada. HTTP não loopback continua
rejeitado. Valor ausente ou inválido falha fechado: callback retorna indisponibilidade,
solicitação não dispara e consentimento não é persistido.

Em todo projeto Supabase remoto, as URLs de redirect permitidas devem corresponder
exatamente a `${APP_ORIGIN}/auth/callback`. Wildcards ou origem derivada de `Host`,
`Origin`, `Referer`, forwarded headers ou parâmetros do usuário não são aceitos. O
`config.toml` local permite exclusivamente `http://127.0.0.1:*/auth/callback` porque o
E2E reserva uma porta loopback efêmera; essa exceção não pertence à configuração de
homologação ou produção e continua condicionada ao launcher local fail-closed.

## MFA TOTP e níveis de garantia

- `/conta/seguranca` permite ao usuário autenticado cadastrar um fator TOTP por QR Code
  ou chave manual. O fator só fica ativo após challenge e verificação do código.
- `/mfa` eleva uma sessão AAL1 para AAL2 usando somente um fator verificado pertencente
  ao usuário atual.
- Uma conta sem fator verificado pode operar em AAL1. Ao existir fator verificado, AAL1
  não libera páginas comerciais, APIs, RPCs ou dados; a sessão precisa atingir AAL2.
- Remover um fator exige sessão viva em AAL2 e revalida que o fator pertence ao usuário.
  Antes do `unenroll`, todas as outras sessões do mesmo usuário são revogadas; falha
  nessa revogação mantém o fator ativo. O JWT antigo pode continuar assinado até
  expirar, mas `current_session_is_live`, guards, RPCs e RLS o bloqueiam imediatamente.
- Sessões de recuperação são direcionadas exclusivamente à redefinição de senha e não
  são tratadas como sessão comercial, mesmo quando a claim informar AAL2.
- Falha ao ler nível, claims ou a RPC `current_session_is_live` resulta em bloqueio.

A aplicação ocorre em camadas: guard SSR, autorização de Route Handlers, resolução
de permissões, RPCs e policies RLS restritivas. A migration acrescenta a policy
`authenticated_session_mfa_gate` às tabelas autenticadas existentes. O helper privado
confere `session_id`, `auth.sessions`, expiração e AAL da sessão; a existência do fator é
consultada sem expor seu segredo.

## Lembrar navegador

O checkbox “Lembrar neste navegador por até 30 dias” começa desmarcado.

- Desmarcado, ausente ou inválido: cookies de autenticação sem `Max-Age` ou `Expires`,
  válidos somente durante a sessão do navegador.
- Marcado: um marker assinado por HMAC limita a duração absoluta a 30 dias. Marker
  adulterado, expirado ou sem `AUTH_SESSION_COOKIE_SECRET` de pelo menos 32 bytes volta
  para sessão temporária.
- Cookies de autenticação e do marker usam `HttpOnly`, `SameSite=Lax`, `Path=/` e
  `Secure` em HTTPS.
- O limite de 30 dias não renova a partir de refresh e nunca ignora MFA.
- Tokens de autenticação não são gravados em `localStorage`. A única persistência local
  opcional existente é a preferência visual de tema, condicionada ao consentimento
  funcional.

O valor lógico de `AUTH_SESSION_COOKIE_SECRET` deve ser provisionado por canal privado
e não pode ser versionado, impresso ou reutilizado como outra credencial. Nos ambientes
hospedados ele nunca entra diretamente no env: o configurador grava o valor em arquivo
root-only `0640`, o arquivo de ambiente declara apenas
`AUTH_SESSION_COOKIE_SECRET_SOURCE`, o Compose monta essa origem read-only e a aplicação
recebe somente `AUTH_SESSION_COOKIE_SECRET_FILE=/run/secrets/auth_session_cookie_secret`.
Injeção direta por `AUTH_SESSION_COOKIE_SECRET` é fallback exclusivo de teste local e é
rejeitada pelo validador dos containers hospedados.

## Cookies e documentos legais

O banner global oferece “Aceitar todos”, “Somente essenciais” e personalização. As
categorias essenciais e de segurança permanecem ativas; funcionais, desempenho e
análise começam desmarcadas. A preferência é versionada, validada por whitelist e salva
em cookie `HttpOnly`, `SameSite=Lax`, `Path=/` e `Secure` em HTTPS. Não há vendor
opcional carregado por padrão.

Os documentos públicos são:

- `/termos-de-uso`;
- `/politica-de-privacidade`;
- `/politica-de-cookies`.

O cadastro exige aceites separados e versionados dos Termos e da Política de
Privacidade. Consentimento de cookies não satisfaz esse requisito. Cadastro público
sem os dois aceites exatos falha fechado no banco. A migration registra o requisito e o aceite em `private.legal_acceptance_requirements` e
`private.legal_acceptances`, sem grants para `anon`, `authenticated` ou `service_role`,
com RLS forçada e bloqueio de update/delete. A aprovação de um perfil novo falha se o
aceite exigido não estiver presente.

Contas QA efêmeras fornecem os mesmos dois aceites exatos; o marker de fixture não cria
bypass. Apenas inserts SQL sem metadata executados como `postgres` são tratados como fixtures
pgTAP; `postgres` já é uma identidade fora da fronteira do Data API. Esse desvio local permanece
coberto por teste de escopo estreito.

Razão social, endereço, controlador, DPO, contato legal, bases legais, retenção e
procedimentos de titulares permanecem explicitamente pendentes de revisão jurídica.
Nenhuma entidade ou informação de contato foi presumida. As versões atuais são drafts
técnicos e não devem ser promovidas como texto jurídico aprovado.

## Operação e ativação futura

Antes de qualquer ativação remota:

1. obter aprovação jurídica e versionar novos textos quando necessário;
2. provisionar `APP_ORIGIN` e o valor lógico do segredo HMAC por canal privado,
   materializando-o no secret store root-only e declarando somente
   `AUTH_SESSION_COOKIE_SECRET_SOURCE` no arquivo de ambiente;
3. configurar redirects exatos, SMTP, TOTP e o template recovery com `TokenHash` no
   projeto Supabase de destino;
4. comprovar backup e restore isolado;
5. executar reset local, pgTAP, lint, typecheck, testes, build e E2E completos;
6. provar os nove perfis, sessão temporária/lembrada, recovery, AAL1/AAL2, APIs e RLS;
7. inspecionar logs para confirmar ausência de códigos, tokens e parâmetros sensíveis;
8. aplicar somente a migration aprovada, monitorar 401/403/5xx e manter rollback da
   aplicação preparado.

## Rollback e limitações

- Antes de migration remota, rollback é remover a imagem candidata e restaurar a
  configuração anterior; o banco permanece intacto.
- Depois da migration, não reabrir acesso removendo a policy restritiva, restaurando
  grants amplos ou aceitando sessão revogada. Correção deve ser roll-forward por nova
  migration testada. Rollback do aplicativo precisa manter compatibilidade com os
  helpers de sessão/AAL ou falhar fechado.
- Rotacionar o arquivo-fonte do segredo HMAC invalida markers de duração lembrada, mas
  não substitui revogação de sessão no Supabase.
- Entrega de e-mail depende de SMTP e redirects configurados; indisponibilidade deve ser
  registrada como bloqueio, nunca testada em produção como substituto.
- O gate local fixa Supabase CLI 2.115.0, que contém a correção de resolução/reload
  do `content_path` do template Auth. O asset HTML não contém segredo e precisa
  permanecer legível pelo processo não-root (`0644`); o preparo impõe esse modo.
- Cadastro pode permanecer desabilitado por configuração operacional. O fluxo legal só
  é exercitado quando cadastro público é autorizado.
- QR Code e chave manual são dados sensíveis exibidos somente durante enrollment; não
  existem recovery codes neste incremento.
- Gates locais finais aprovados: formato, lint, typecheck, 468 testes Vitest, oito
  testes Node, build de 39 rotas, reset do Supabase local, 1.018 pgTAP em 25 arquivos e
  Playwright com 19 cenários aprovados. O único skip é o cenário remoto de homologação,
  deliberadamente fora deste incremento local; SMTP e configurações hospedadas não
  foram usados como substituto.
- A matriz E2E criou nove identidades sintéticas locais e removeu as nove ao concluir.
  A inspeção sanitizada encontrou zero artefatos Playwright, mensagens residuais,
  parâmetros de token/código em URL, HTTP 5xx, panic ou fatal.
- Auditorias finais sem achados: dependências (`pnpm audit` e OSV sobre 521 pacotes),
  segredos (Gitleaks na árvore e em 266 commits), schema lint e advisors locais de
  segurança e performance.
- Restore isolado aprovado em dois projetos PostgreSQL 17 efêmeros: 41 migrations,
  backup lógico, owners, privilégios, fingerprint e os 1.004 pgTAP coincidiram entre
  fonte e alvo. O rehearsal copia o template Auth sem incluir configuração remota.
