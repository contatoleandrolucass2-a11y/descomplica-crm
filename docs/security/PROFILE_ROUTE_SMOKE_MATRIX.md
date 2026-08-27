# Matriz de smoke por perfil e rota

## Contrato

Esta matriz descreve o inventário HTTP de 21 rotas protegidas e deve ser validada
com contas QA sintéticas. O catálogo RBAC final contém exatamente 17 páginas;
as quatro rotas futuras continuam no smoke para comprovar o `403` fail-closed.

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

Produção e instalação limpa convergem para as mesmas 17 entradas de catálogo. A
migration Auth/MFA remove somente as quatro identidades excedentes encontradas
no restore (`WF16`, `CAIXA`, `WF14` e `WF15`), preserva `user_roles` e overrides
e recompõe somente os vínculos herdados já existentes em produção.

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
| `/app/simulacao/calcular-documentacao`    |      403 |     403 |                                    403 |                                                  403 |  redirect |
| `/app/simulacao/caixa`                    |      403 |     403 |                                    403 |                                                  403 |  redirect |
| `/app/simulacao/tabela-direta`            |      403 |     403 |                                    403 |                                                  403 |  redirect |
| `/app/simulacao/tabela-investidor`        |      403 |     403 |                                    403 |                                                  403 |  redirect |
| `/admin`                                  |      200 |     200 |                                    403 |                                                  403 |  redirect |
| `/admin/usuarios`                         |      200 |     200 |                                    403 |                                                  403 |  redirect |
| `/admin/paginas`                          |      200 |     200 |                                    403 |                                                  403 |  redirect |

Os papéis produtivos legados `supervisor`, `broker_lead` e `user` conservam as mesmas
sete páginas de `broker`, `coordinator` e `real_estate`. Eles não são criados nem usados
como fixtures pelos nove perfis do smoke novo, mas entram no fingerprint do rehearsal.
Produção não possui overrides individuais; o processo continua preservando a tabela
integralmente caso overrides sejam adicionados antes do cutover.

Autorização de página e execução de motor são gates distintos. Os dois `200` de
simulação autorizam somente hub e WF13. As outras quatro rotas falham antes da
renderização. Flags, allowlist, permissão de execução e política comercial
continuam validadas separadamente.

## Matriz de APIs somente leitura/fail-closed

| Contrato                                                | `master`              | outros oito perfis            | visitante |
| ------------------------------------------------------- | --------------------- | ----------------------------- | --------- |
| `GET /api/dashboard/status`                             | 200                   | conforme `crm.dashboard.view` | 401       |
| `GET /api/official-simulator/associativo-fluxo-linear`  | 200                   | 403                           | 401       |
| `POST /api/official-simulator/associativo-fluxo-linear` | 200, fixture de ouro  | 403                           | 401       |
| `POST /api/ingest/qlik`                                 | 503, flag desligada   | 503                           | 503       |
| `POST /api/ingest/salesforce`                           | 503, flag desligada   | 503                           | 503       |
| `POST /api/refresh/salesforce`                          | 503, flag desligada   | 503                           | 503       |
| `POST /api/commercial-engine/simulator.wf14`            | 503, motor desligado  | 503                           | 503       |
| `GET /api/health`                                       | 200, sem dado privado | 200                           | 200       |

Os quatro `POST` em `503` retornam antes de qualquer escrita ou chamada externa. O smoke
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
4. abrir diretamente cada uma das 21 URLs e comparar o resultado com a tabela;
5. testar os Route Handlers vinculados às permissões sem gravar dados;
6. abrir `/conta/seguranca` e provar o estado MFA aplicável;
7. executar logout e confirmar bloqueio ao voltar, recarregar e reabrir URL protegida.

O `403` é verificado no response HTTP direto e na navegação do navegador. O Proxy
antecipa a permissão exata das 21 rotas versionadas antes que uma loading boundary
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
