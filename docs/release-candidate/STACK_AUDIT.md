# Auditoria da pilha #26–#31

## Escopo congelado

| PR  | Head auditado                              | Entrega                       |
| --- | ------------------------------------------ | ----------------------------- |
| #26 | `81968eb72371d5a1a794d48703de41a7feb58f70` | Fundação visual/paridade      |
| #27 | `7b84ab3`                                  | Reconciliação de fontes       |
| #28 | `8ae8a42`                                  | Prova Supabase/RLS            |
| #29 | `96d48b0`                                  | Read model v3                 |
| #30 | `1f570d0`                                  | Relay/mappings/cutover inerte |
| #31 | `d00118fe62296fa3e23e266585899e3ee3a78478` | Plataforma dos motores        |

O SHA curto nesta tabela identifica commits locais já congelados; o merge train
deve registrar os SHAs completos novamente imediatamente antes de qualquer
merge.

## Achados resolvidos neste incremento

1. Runner Playwright formal e job CI inexistentes: adicionados.
2. Nove perfis existiam somente no REST: agora também percorrem login, catálogo
   exato e as 21 rotas diretas no navegador, negando qualquer privilégio extra.
3. Conta pending autenticada entrava em ciclo `/login`↔`/app`: ausência de
   contexto aprovado agora termina em 403 genérico.
4. Quatro versões remotas faltavam localmente: markers históricos no-op foram
   adicionados sem copiar verifier, grants, fórmula ou DDL inseguro.
5. Hash do relay e migration comercial faltavam na matriz: corrigidos.
6. Doze divergências globais de Prettier: corrigidas mecanicamente, sem mudança
   semântica.
7. Healthcheck não identificava release: agora retorna somente identificador
   sanitizado `DEPLOYMENT_VERSION` ou `unknown`.
8. CI não executava formato, pgTAP, E2E, matriz visual ou restore: gates
   separados foram versionados.
9. O primeiro restore local comparava apenas contagens no mesmo cluster: agora
   usa origem/alvo independentes, fingerprint canônico, owners, privilégios
   efetivos, RLS, policies, funções, DDL, ledger e dados agregados, com os mesmos
   gates antes/depois e cleanup comprovado.
10. O runner visual podia substituir o baseline antes de falhar: candidatos e
    baseline agora são separados; a verificação exige baseline igual ao `HEAD` e
    a promoção é explícita, transacional e posterior aos checks.
11. O E2E aceitava qualquer `main` nas rotas autorizadas: cada uma das 21 rotas
    agora exige seu heading próprio e prova sua ausência nas negações.
12. A inicialização Supabase da CI podia imprimir credenciais locais efêmeras:
    a saída bruta foi suprimida e os diagnósticos visuais são publicados mesmo
    quando o gate falha.

## Bloqueios externos mantidos

| ID              | Bloqueio                                                             | Consequência                                         | Gate de saída                                                                         |
| --------------- | -------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| DB-ORDER-01     | Três migrations locais têm versão anterior ao último registro remoto | Push normal não produz a árvore ensaiada             | Escolher consolidação/reversionamento ou autorizar `--include-all` após restore exato |
| DB-RESTORE-01   | Backup privado atual de produção não foi fornecido                   | Restore local não prova dados/objetos remotos atuais | Backup novo, checksum, destino isolado e relatório aprovado                           |
| QLIK-OWNER-01   | Owner operacional e backup do workflow `r4DyPyOTDtoROXq0` ausentes   | Relay não pode ativar                                | Aprovação nominal com autoridade/evidência                                            |
| QLIK-READERS-01 | Leitores GET residuais não inventariados                             | Hardening pode interromper consumidores              | Inventário e plano de migração aprovados                                              |
| QLIK-SECRET-01  | HMAC e credencial DB não provisionados                               | HTTP→DB positivo não pode ser testado                | Provisionamento privado, TLS verify-full e rotação                                    |
| MAP-01          | Mappings reais não assinados                                         | v3 não pode associar fatos                           | Manifesto oficial, dry-run sem conflito e dupla confirmação                           |
| V3-GRANT-01     | Grants/coortes não aprovados                                         | Rotas v3 ficam 404/403                               | Matriz de coortes e migration aditiva aprovada                                        |
| COMM-01         | Políticas/casos de ouro oficiais ausentes                            | Motores ficam bloqueados                             | Pacotes assinados por engine/version                                                  |
| HOST-01         | Host canônico diverge entre documentação e deploy                    | Risco Auth/cookie/CORS                               | Definição única de domínio e evidência DNS/TLS                                        |
| QA-REMOTE-01    | Conta QA dedicada/coortes de homologação não confirmadas             | E2E remoto autenticado bloqueado                     | Conta QA privada, nunca Master/Admin pessoal                                          |

## Limitações aceitas

- `forbidden()`/`notFound()` podem completar com shell HTTP 200 após streaming;
  o Playwright valida a UI terminal e ausência do conteúdo, enquanto RPC/RLS
  validam a fronteira autoritativa.
- Relay e motores não recebem exceção TLS test-only. Handler e banco são
  provados em camadas até existir credencial privada `verify-full`.
- A evidência visual versionada registra o commit limpo usado na captura; o
  commit final pode ser posterior por conter somente os artefatos gerados.
- O fingerprint de ACL compara owner separadamente e privilégios efetivos sem
  depender do grantor que materializou o restore. `aclGrantorsCompared=false`
  fica explícito; nenhuma ACL do alvo é alterada para forçar igualdade.
- Imagens base Docker continuam por tag; digest imutável deve ser registrado no
  pacote de deploy aprovado.

## Resultado

A pilha está apta para revisão local/CI como release candidate fail-closed. Não
está apta para migration remota, ativação, merge train ou deploy enquanto algum
bloqueio da tabela permanecer aberto.
