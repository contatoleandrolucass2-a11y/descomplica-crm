# Auditoria integral da pilha #26–#33 e fechamento funcional

## Escopo congelado

| Ordem | PR / incremento | Head auditado                              | Entrega principal                                    |
| ----: | --------------- | ------------------------------------------ | ---------------------------------------------------- |
|     1 | #26             | `81968eb72371d5a1a794d48703de41a7feb58f70` | Fundação visual e paridade                           |
|     2 | #27             | `7b84ab316cae4695d4da682d8c2512c982b98cdd` | Reconciliação de fontes                              |
|     3 | #28             | `8ae8a42a7182e432657676e28b4ec29ef7eb354b` | Scopes/RLS e hardening ainda não autorizados         |
|     4 | #29             | `96d48b0e64ad85c5020d4ec69b6f1dd0bf408e08` | Read model v3                                        |
|     5 | #30             | `1f570d0a7b3ce64571019b121b0b4aff132e1676` | Relay, mappings e cutover inertes                    |
|     6 | #31             | `d00118fe62296fa3e23e266585899e3ee3a78478` | Plataforma dos 14 motores                            |
|     7 | #32             | `7e6922003405b05dda1e4bca0a6881a592fe035f` | Gates E2E da release candidate                       |
|     8 | #33             | `b552fa886a1855ffe5eea47b0b52ded8dfd17a92` | Homologação visual isolada                           |
|     9 | novo incremento | registrado no PR draft                     | Fechamento determinístico e preparação para produção |

Os oito heads anteriores formam uma cadeia linear confirmada. O head do novo
incremento deve ser registrado no manifesto e reensaiado antes do PR final; a
cadeia não concede autorização de merge.

## Fechamentos deste incremento

1. A especificação passou a ter matriz rastreável por página, componente,
   fonte, permissão, teste, evidência, estado e bloqueio.
2. As 21 rotas protegidas, incluindo três administrativas, entraram na matriz
   visual; as 18 páginas da referência permanecem identificadas separadamente.
3. Breadcrumbs são derivados apenas do catálogo autorizado e toleram ciclos.
4. Aprovação de usuário exige Master, permissões server-side, papel aprovável,
   escopos oficiais explícitos, motivo e confirmação; não cria associação por
   inferência.
5. Metas de funil e pontos agora aceitam somente draft/preview versionado,
   privado e Master-only. Não existe operação de promoção ou ativação.
6. Ranking não trata configuração legada como política comercial oficial.
7. Os cinco simuladores refletem a estrutura funcional da especificação, mas
   seguem sem cálculo, exportação, persistência ou resultado comercial.
8. Read model v3 valida dataset/escopo e usa as cinco etapas mensais exatas;
   estados stale, indisponível e erro permanecem explícitos.
9. Backup produtivo criptografado, restore representativo sem rede, aplicação
   das dez migrations futuras e rollback limpo foram comprovados sem escrita
   remota. O plaintext temporário foi removido.
10. Caller técnico Qlik continua identificado; mappings reais não foram
    simulados nem declarados sem manifesto oficial.

## Riscos de migrations P0

| ID       | Migration        | Risco                                                                  | Disposição obrigatória                                                                                 |
| -------- | ---------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| DB-P0-01 | `20260807185611` | Revoga caminho legado Qlik antes do cutover                            | Preservar como histórico local; transportar apenas efeitos aditivos em migration forward posterior     |
| DB-P0-02 | `20260809144137` | Pode converter/desativar acessos antes de mappings e coortes aprovados | Separar schema aditivo do enforcement e migrar somente com manifesto/reconciliação                     |
| DB-P0-03 | `20260809144143` | Revoga leitores diretos ainda não atribuídos                           | Separar ponte/RPC do hardening; revogar somente após relay, consumidores, canário e rollback aprovados |

O restore prova que os bytes atuais executam; não prova que esses efeitos são
operacionalmente seguros. `migration repair`, `--include-all` e `db push` não
são atalhos autorizados.

## Bloqueios externos atuais

| ID              | Bloqueio                                                        | Consequência                             | Gate de saída                                           |
| --------------- | --------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------- |
| QLIK-OWNER-01   | Owner operacional e backup de `r4DyPyOTDtoROXq0` ausentes       | Relay não ativa                          | Aceite formal de titular e substituto                   |
| QLIK-READERS-01 | 40 leituras `GET` sem consumidor atribuído                      | Hardening pode interromper leitores      | Inventário e plano de migração aprovados                |
| QLIK-SECRET-01  | HMAC e credencial DB mínima não provisionados                   | Relay positivo não executa               | Provisionamento privado, TLS verify-full e rotação      |
| MAP-01          | Manifesto real de mappings ausente                              | v3 não associa fatos reais               | IDs/evidências oficiais, preview e conflitos resolvidos |
| V3-GRANT-01     | Coortes e grants não aprovados                                  | v3 permanece shadow                      | Matriz de coortes e migration aditiva aprovada          |
| COMM-01         | Políticas e casos de ouro dos 14 motores ausentes               | Motores permanecem bloqueados            | Pacote oficial versionado por engine                    |
| DATA-01         | Fonte/owner oficial de estoque e semânticas comerciais ausentes | Métricas dependentes ficam indisponíveis | Contrato e ownership aprovados                          |
| WINDOW-01       | Janelas/aprovadores de canário, cutover e rollback ausentes     | Nenhuma ativação                         | Runbook preenchido e aceite de todos os responsáveis    |

O restore produtivo exato e a conta QA da homologação, antes bloqueios, foram
comprovados. Isso não fecha nenhum bloqueio comercial ou operacional acima.

## Limitações explícitas

- A homologação usa somente identidades e fixtures sintéticas; não valida
  mappings, políticas ou números comerciais reais.
- O fingerprint local compara owner e privilégios efetivos, sem depender do
  grantor materializado pelo restore (`aclGrantorsCompared=false`).
- O restore representativo validou integridade estrutural e o fechamento dos
  acessos críticos; pgTAP integral roda separadamente nas duas stacks locais.
- Imagens Docker por tag exigem digest registrado no pacote de deploy aprovado.
- Streaming pode produzir shell HTTP 200 para `forbidden()`/`notFound()`; UI
  terminal e ausência de conteúdo são testadas, enquanto RPC/RLS são a
  fronteira autoritativa.

## Resultado

A pilha está apta a validação local, CI e homologação isolada como release
candidate fail-closed. Permanece **não autorizada** para merge, migration
remota, importação real, ativação, cutover, hardening destrutivo ou deploy de
produção.
