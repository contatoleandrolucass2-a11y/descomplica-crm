# Hotfix de acesso Master à página WF13

## Diagnóstico sanitizado

Estado produtivo observado em 14 de agosto de 2026, antes da correção:

| Gate                          | Evidência somente leitura                                 | Resultado                         |
| ----------------------------- | --------------------------------------------------------- | --------------------------------- |
| Guard da página               | `/app/simulacao/[simulator]` exige `crm.simulators.view`  | correto                           |
| Conta de revisão              | perfil ativo e papel `master`                             | correto                           |
| Permissão de página efetiva   | `_internal_has_permission(..., 'crm.simulators.view')`    | `false`                           |
| Permissão de execução efetiva | `_internal_has_permission(..., 'crm.simulators.execute')` | `true`                            |
| Catálogo                      | hub e rota WF13 ausentes de `app_pages`                   | divergente                        |
| Runtime                       | modo `active`, allowlist apenas `simulator.wf13`          | correto                           |
| Migration remota              | `20260813192928` aplicada; contém execução Master-only    | correto, incompleto para a página |
| Conteúdo da migration remota  | não contém `crm.simulators.view` nem `app_pages`          | causa confirmada                  |

Nenhum identificador, e-mail, token ou linha comercial integra esta evidência.
A falha ocorre antes do componente do simulador: não é cache, CTA, fórmula ou
endpoint. O guard fecha corretamente porque o banco não devolve a permissão de
página.

## Correção mínima

`20260814045436_wf13_master_page_access_convergence.sql`:

1. cria/normaliza `crm.simulators.view` com nível 100;
2. remove vínculos não Master e overrides diretos somente dessa chave;
3. vincula a chave exclusivamente ao papel `master`;
4. cria/normaliza somente o hub e a entrada WF13 em `app_pages`;
5. valida as invariantes na própria transação.

O gate de execução permanece separado e inalterado. A migration não muda flag,
fórmula, dados, RLS, grants de tabela, usuário ou integração. WF16, CAIXA, WF14,
WF15, runtime comercial, Qlik, Salesforce e n8n permanecem desligados.

## Aplicação e prova

Antes da produção: backup lógico verificável, restore isolado representativo,
reset local, pgTAP e CI verdes. A aplicação remota deve usar somente a migration
forward posterior ao topo remoto; nunca `--include-all`, `migration repair` ou
SQL avulso.

Probes pós-aplicação não retornam conteúdo comercial:

- Master: permissão de página e execução verdadeiras; hub/WF13 visíveis;
- não Master: permissão de página e execução falsas;
- anônimo: redirecionamento/`401` conforme rota;
- POST WF13: somente Master same-origin com payload válido;
- outros motores: fora da allowlist e bloqueados;
- saúde: SHA esperado, zero HTTP 5xx crítico e zero reinício.

## Roll-forward seguro

Se a correção produzir regressão, desativar `simulator.wf13` é a contenção
imediata fail-closed. A reversão de banco, se necessária, deve ser uma nova
migration forward que remova o vínculo Master e desative as duas entradas do
catálogo. Não reabrir acesso a outros papéis e não apagar histórico.
