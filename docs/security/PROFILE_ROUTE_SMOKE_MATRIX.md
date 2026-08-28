# Matriz de smoke por perfil e rota

## Contrato

Esta matriz descreve o inventário HTTP de 24 rotas protegidas e deve ser validada
com contas QA sintéticas. O catálogo RBAC canário contém exatamente 24 páginas;
as sete páginas migradas continuam fail-closed quando suas flags estão desligadas.

Perfis exigidos:

- `master`;
- `admin`;
- `manager`;
- `broker`;
- `coordinator`;
- `real_estate`;
- `house`;
- `partnership_channel`;
- `pending`.

Legenda:

- `200`: página autorizada após sessão viva e assurance suficiente;
- `403`: sessão autenticada, mas sem a permissão da rota;
- `redirect`: sem sessão vai para `/login`; fator verificado ainda em AAL1 vai para
  `/mfa`; sessão de recovery vai para `/redefinir-senha`.

O baseline anterior converge para 17 entradas. A migration canário acrescenta
somente sete páginas Master-only, preservando `user_roles`, overrides e todos os
vínculos herdados dos demais papéis.

| Rota protegida                            | `master` | `admin` | `broker`, `coordinator`, `real_estate` | `manager`, `house`, `partnership_channel`, `pending` | visitante |
| ----------------------------------------- | -------: | ------: | -------------------------------------: | ---------------------------------------------------: | --------: |
| `/app`                                    |      200 |     200 |                                    200 |                                                  403 |  redirect |
| `/app/etapas/oportunidades`               |      200 |     200 |                                    200 |                                                  403 |  redirect |
| `/app/etapas/agendamentos`                |      200 |     200 |                                    200 |                                                  403 |  redirect |
| `/app/etapas/visitas`                     |      200 |     200 |                                    200 |                                                  403 |  redirect |
| `/app/etapas/pastas`                      |      200 |     200 |                                    200 |                                                  403 |  redirect |
| `/app/etapas/vendas`                      |      200 |     200 |                                    200 |                                                  403 |  redirect |
| `/app/ranking`                            |      200 |     200 |                                    200 |                                                  403 |  redirect |
| `/app/canal-de-parcerias`                 |      200 |     403 |                                    403 |                                                  403 |  redirect |
| `/app/configuracoes`                      |      200 |     200 |                                    403 |                                                  403 |  redirect |
| `/app/configuracoes/metas`                |      200 |     200 |                                    403 |                                                  403 |  redirect |
| `/app/configuracoes/metas/parcerias`      |      200 |     200 |                                    403 |                                                  403 |  redirect |
| `/app/configuracoes/metas/pontos`         |      200 |     200 |                                    403 |                                                  403 |  redirect |
| `/app/simulacao`                          |      200 |     403 |                                    403 |                                                  403 |  redirect |
| `/app/simulacao/associativo-fluxo-linear` |      200 |     403 |                                    403 |                                                  403 |  redirect |
| `/app/simulacao/calcular-documentacao`    |      200 |     403 |                                    403 |                                                  403 |  redirect |
| `/app/simulacao/caixa`                    |      200 |     403 |                                    403 |                                                  403 |  redirect |
| `/app/simulacao/tabela-direta`            |      200 |     403 |                                    403 |                                                  403 |  redirect |
| `/app/simulacao/tabela-investidor`        |      200 |     403 |                                    403 |                                                  403 |  redirect |
| `/app/simulacao/tabela`                   |      200 |     403 |                                    403 |                                                  403 |  redirect |
| `/app/discador`                           |      200 |     403 |                                    403 |                                                  403 |  redirect |
| `/app/discador/previsao-final-de-semana`  |      200 |     403 |                                    403 |                                                  403 |  redirect |
| `/admin`                                  |      200 |     200 |                                    403 |                                                  403 |  redirect |
| `/admin/usuarios`                         |      200 |     200 |                                    403 |                                                  403 |  redirect |
| `/admin/paginas`                          |      200 |     200 |                                    403 |                                                  403 |  redirect |

Os papéis produtivos legados `supervisor`, `broker_lead` e `user` conservam as mesmas
sete páginas de `broker`, `coordinator` e `real_estate`. Eles não são criados nem usados
como fixtures pelos nove perfis do smoke novo, mas entram no fingerprint do rehearsal.
Produção não possui overrides individuais; o processo continua preservando a tabela
integralmente caso overrides sejam adicionados antes do cutover.

Autorização de página e execução de motor são gates distintos. Os `200` das
sete páginas novas pressupõem o canário de homologação com suas flags explícitas.
Flags desligadas fazem essas rotas retornarem `403`; permissão de execução,
estoque e políticas continuam validados separadamente.

## Matriz de APIs somente leitura/fail-closed

| Contrato                                                | `master`               | outros oito perfis            | visitante |
| ------------------------------------------------------- | ---------------------- | ----------------------------- | --------- |
| `GET /api/dashboard/status`                             | 200                    | conforme `crm.dashboard.view` | 401       |
| `GET /api/official-simulator/associativo-fluxo-linear`  | 200                    | 403                           | 401       |
| `POST /api/official-simulator/associativo-fluxo-linear` | 200, fixture de ouro   | 403                           | 401       |
| `GET /api/inventory`                                    | 200 ou 404 fail-closed | 403                           | 401       |
| `GET /api/weekend-forecast`                             | 200, estado sintético  | 403                           | 401       |
| `POST /api/weekend-forecast`                            | 404, escrita desligada | 403                           | 401       |
| `POST /api/ingest/qlik`                                 | 404, flag desligada    | 404                           | 404       |
| `POST /api/ingest/salesforce`                           | 404, flag desligada    | 404                           | 404       |
| `POST /api/refresh/salesforce`                          | 404, flag desligada    | 404                           | 404       |
| `POST /api/commercial-engine/simulator.wf14`            | 404, motor desligado   | 404                           | 404       |
| `GET /api/health`                                       | 200, sem dado privado  | 200                           | 200       |

Os quatro `POST` em `404` retornam antes de qualquer escrita ou chamada externa. O smoke
os repete nos nove perfis para provar o default-off; WF13 é o único motor executado, com
fixture sintética já versionada e apenas na sessão `master`.

## Rotas de conta e autenticação

| Estado                   | `/conta/seguranca`          | `/mfa`                      | rota protegida              | API protegida                    |
| ------------------------ | --------------------------- | --------------------------- | --------------------------- | -------------------------------- |
| visitante                | redirect `/login`           | redirect `/login`           | redirect `/login`           | 401                              |
| autenticado, sem fator   | 200                         | 200, sem desafio pendente   | conforme perfil             | conforme permissão               |
| fator verificado, AAL1   | redirect `/mfa`             | 200                         | redirect `/mfa`             | 403 `mfa_required`               |
| fator verificado, AAL2   | 200                         | redirect `/`                | conforme perfil             | conforme permissão               |
| sessão de recovery       | redirect `/redefinir-senha` | redirect `/redefinir-senha` | redirect `/redefinir-senha` | 403 `password_recovery_required` |
| sessão inválida/revogada | redirect `/login`           | redirect `/login`           | redirect `/login`           | 401 ou fail-closed               |

`/conta/seguranca` depende somente de identidade autenticada e assurance, portanto deve
ser acessível aos nove perfis sem conceder permissão comercial. Remoção de fator só pode
ser concluída em AAL2. A remoção revoga antes as outras sessões do mesmo usuário; um
segundo navegador AAL1 recebe `403 mfa_required` antes da remoção. Depois da revogação,
ele perde `current_session_is_live`, recebe `401` e é enviado ao login, mesmo enquanto o
JWT local ainda não expirou.

## Sequência obrigatória por perfil

Para cada perfil, o E2E deve:

1. autenticar e confirmar a identidade/papel esperados;
2. verificar a página inicial autorizada (`/app` para `master`, `admin`, `broker`,
   `coordinator` e `real_estate`; superfície auth-only para os quatro perfis sem página);
3. comparar o menu com o catálogo permitido;
4. abrir diretamente cada uma das 24 URLs e comparar o resultado com a tabela;
5. testar os Route Handlers vinculados às permissões sem gravar dados;
6. abrir `/conta/seguranca` e provar o estado MFA aplicável;
7. executar logout e confirmar bloqueio ao voltar, recarregar e reabrir URL protegida.

O `403` é verificado no response HTTP direto e na navegação do navegador. O Proxy
antecipa a permissão exata das 24 rotas versionadas antes que uma loading boundary
possa mascará-la com `200` streamed; layout, página, APIs e RLS repetem o gate. Conteúdo
e título da página negada também devem permanecer ausentes. Para Admin, as três páginas
de metas carregam a base legada somente leitura e exibem explicitamente o rascunho como
indisponível, pois política comercial continua Master-only.

Além dos nove perfis, o gate deve cobrir recuperação de senha com resposta genérica,
link válido/expirado, senha forte, revogação de sessões, enrollment/challenge/removal
TOTP, sessão temporária e lembrada, banner/personalização de cookies, documentos,
aceites legais separados e visitante anônimo.

## Evidência esperada

Registrar somente status, destino final, papel sanitizado, chave de permissão, estado
AAL e resultado do teste. Nunca registrar e-mail, UUID, cookie, token, senha, código
TOTP, QR Code ou chave manual. Se Docker, Supabase, SMTP ou navegador estiver
indisponível, marcar o cenário como bloqueado; não converter em aprovado nem usar
produção como substituto.

## Baseline local anterior à reconciliação (2026-08-24)

- Playwright: 11 cenários aprovados, um cenário remoto ignorado explicitamente e zero
  falhas.
- Matriz: nove perfis por 21 URLs diretas, menus, páginas iniciais, APIs,
  `/conta/seguranca` e logout. Dashboard, status/execução WF13 e os quatro handlers
  default-off são validados por perfil.
- Isolamento: visitante, recovery, AAL1/AAL2, sessões temporária/lembrada, sessão
  secundária revogada, RPCs e RLS aprovados.
- Higiene: nove usuários sintéticos removidos, nenhuma persistência e nenhuma evidência
  contendo e-mail, identificador, cookie, token, senha, TOTP, QR Code ou chave manual.
