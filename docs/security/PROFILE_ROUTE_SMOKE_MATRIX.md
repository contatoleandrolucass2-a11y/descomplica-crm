# Matriz de smoke por perfil e rota

## Contrato

Esta matriz descreve o catálogo local atual de 21 rotas protegidas e deve ser validada
com contas QA efêmeras no Supabase local. Não é evidência de homologação ou produção.

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

As colunas “demais perfis” abrangem os sete perfis diferentes de `master` e `admin`.
Overrides e flags não podem ampliar esta expectativa no smoke da fundação.

| Rota protegida                            | `master` | `admin` | demais perfis | visitante |
| ----------------------------------------- | -------: | ------: | ------------: | --------: |
| `/app`                                    |      200 |     403 |           403 |  redirect |
| `/app/etapas/oportunidades`               |      200 |     403 |           403 |  redirect |
| `/app/etapas/agendamentos`                |      200 |     403 |           403 |  redirect |
| `/app/etapas/visitas`                     |      200 |     403 |           403 |  redirect |
| `/app/etapas/pastas`                      |      200 |     403 |           403 |  redirect |
| `/app/etapas/vendas`                      |      200 |     403 |           403 |  redirect |
| `/app/ranking`                            |      200 |     403 |           403 |  redirect |
| `/app/canal-de-parcerias`                 |      200 |     403 |           403 |  redirect |
| `/app/configuracoes`                      |      200 |     403 |           403 |  redirect |
| `/app/configuracoes/metas`                |      200 |     403 |           403 |  redirect |
| `/app/configuracoes/metas/parcerias`      |      200 |     403 |           403 |  redirect |
| `/app/configuracoes/metas/pontos`         |      200 |     403 |           403 |  redirect |
| `/app/simulacao`                          |      200 |     403 |           403 |  redirect |
| `/app/simulacao/associativo-fluxo-linear` |      200 |     403 |           403 |  redirect |
| `/app/simulacao/calcular-documentacao`    |      200 |     403 |           403 |  redirect |
| `/app/simulacao/caixa`                    |      200 |     403 |           403 |  redirect |
| `/app/simulacao/tabela-direta`            |      200 |     403 |           403 |  redirect |
| `/app/simulacao/tabela-investidor`        |      200 |     403 |           403 |  redirect |
| `/admin`                                  |      200 |     200 |           403 |  redirect |
| `/admin/usuarios`                         |      200 |     200 |           403 |  redirect |
| `/admin/paginas`                          |      200 |     403 |           403 |  redirect |

Autorização de página e execução de motor são gates distintos. Um `200` numa rota de
simulador não declara CTA ou cálculo autorizado; flags, allowlist, permissão de execução
e política comercial continuam sendo validadas separadamente e permanecem fora deste
incremento.

## Matriz de APIs somente leitura/fail-closed

| Contrato                                                | `master`              | outros oito perfis | visitante |
| ------------------------------------------------------- | --------------------- | ------------------ | --------- |
| `GET /api/dashboard/status`                             | 200                   | 403                | 401       |
| `GET /api/official-simulator/associativo-fluxo-linear`  | 200                   | 403                | 401       |
| `POST /api/official-simulator/associativo-fluxo-linear` | 200, fixture de ouro  | 403                | 401       |
| `POST /api/ingest/qlik`                                 | 503, flag desligada   | 503                | 503       |
| `POST /api/ingest/salesforce`                           | 503, flag desligada   | 503                | 503       |
| `POST /api/refresh/salesforce`                          | 503, flag desligada   | 503                | 503       |
| `POST /api/commercial-engine/simulator.wf14`            | 503, motor desligado  | 503                | 503       |
| `GET /api/health`                                       | 200, sem dado privado | 200                | 200       |

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
2. verificar a página inicial autorizada (`/app` para `master`, `/admin` para `admin` e
   uma superfície auth-only para perfis sem página comercial);
3. comparar o menu com o catálogo permitido;
4. abrir diretamente cada uma das 21 URLs e comparar o resultado com a tabela;
5. testar os Route Handlers vinculados às permissões sem gravar dados;
6. abrir `/conta/seguranca` e provar o estado MFA aplicável;
7. executar logout e confirmar bloqueio ao voltar, recarregar e reabrir URL protegida.

O `403` é verificado no response HTTP direto e na navegação do navegador, antes que uma
loading boundary possa mascará-lo com `200` streamed. Conteúdo e título da página
negada também devem permanecer ausentes.

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

## Resultado local de 2026-08-24

- Playwright: 11 cenários aprovados, um cenário remoto ignorado explicitamente e zero
  falhas.
- Matriz: nove perfis por 21 URLs diretas, menus, páginas iniciais, APIs,
  `/conta/seguranca` e logout. Dashboard, status/execução WF13 e os quatro handlers
  default-off são validados por perfil.
- Isolamento: visitante, recovery, AAL1/AAL2, sessões temporária/lembrada, sessão
  secundária revogada, RPCs e RLS aprovados.
- Higiene: nove usuários sintéticos removidos, nenhuma persistência e nenhuma evidência
  contendo e-mail, identificador, cookie, token, senha, TOTP, QR Code ou chave manual.
