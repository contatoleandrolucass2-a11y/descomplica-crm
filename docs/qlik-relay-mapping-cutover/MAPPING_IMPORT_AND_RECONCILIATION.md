# Importação e reconciliação de mappings

## Estado seguro deste incremento

O importador recebe decisões humanas já revisadas; ele não descobre relações,
não faz matching por nome e não cria owners, organizações, equipes, carteiras,
responsáveis ou qualquer outro alvo canônico. O preview é o modo padrão e é
somente leitura. Importar mappings não ativa relay, canário, cutover ou read
model v3.

A tabela privada de autoridades nasce vazia. Mesmo que o operador habilite a
flag local, o banco só aceita apply quando existe exatamente uma autoridade
vigente para a combinação de fonte, tipo de entidade e owner, com
`apply_enabled = true`. Criar ou habilitar essa autoridade é uma operação
separada, sujeita a aprovação e migration ou procedimento remoto autorizado.

O arquivo
[`MAPPING_MANIFEST.example.json`](MAPPING_MANIFEST.example.json) contém somente
identificadores fictícios de QA. Ele demonstra o formato e deve produzir
conflitos em um ambiente que não tenha fixtures QA explicitamente provisionadas.
Nunca o use com `--apply`.

## Contrato do manifesto v1

O manifesto é um objeto JSON estrito:

| Campo               | Regra                                                        |
| ------------------- | ------------------------------------------------------------ |
| `schemaVersion`     | literal `1`                                                  |
| `batchRequestId`    | UUID único para o lote                                       |
| `generatedAt`       | ISO 8601 com offset explícito                                |
| `evidenceReference` | referência sanitizada da aprovação do lote                   |
| `mappings`          | entre 1 e 500 payloads de revisão, sem identidades repetidas |

Cada item contém `requestId`, `source`, `entityKind`, `externalId`, `decision`
e `reason`. O par `source + entityKind + externalId` e cada `requestId` devem
ser únicos dentro do lote.

- `verify` também exige `ownerKey`, `targetId`, `effectiveFrom` e
  `evidenceReference`. Owner e alvo precisam existir, estar ativos e possuir
  evidência oficial; o importador não os cria.
- `reject` não aceita `ownerKey`, `targetId` nem `effectiveFrom`.
  `evidenceReference` no item é opcional, mas o motivo continua obrigatório.
- `entityKind` aceita somente `person`, `organization`, `team`, `portfolio`,
  `reporting_scope`, `origin`, `development` ou `location`.
- Campos desconhecidos, timestamps sem offset, valores fora dos limites,
  duplicatas e mais de 500 itens são rejeitados antes da chamada ao banco.

O `batchRequestId` identifica a execução idempotente. Alterar qualquer conteúdo
exige novo `batchRequestId` e novos `requestId` para os itens alterados. Nunca
reutilize IDs para encobrir uma correção.

## Credenciais e autorização

O comando lê credenciais exclusivamente destas variáveis de ambiente, injetadas
por canal privado e não persistidas em arquivo, histórico ou documentação:

- `NEXT_PUBLIC_SUPABASE_URL`;
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
- `CRM_MAPPING_IMPORT_ACCESS_TOKEN`, contendo sessão curta de um reviewer
  explicitamente autorizado.

As RPCs ainda validam no servidor usuário autenticado, perfil Master e permissão
`crm.ingest.manage`. A chave publicável não substitui a sessão. A CLI rejeita
tokens anônimos ou `service_role` como identidade do reviewer e nunca imprime
credenciais nem o corpo bruto de erros remotos.

A primitiva elementar `review_crm_source_identity_mapping(jsonb)` não possui
grant para `authenticated`, `anon` ou `service_role`; somente a função de apply,
como owner SQL, a chama depois de revalidar o lote, a autoridade e os hashes.
Assim, uma sessão Master não consegue contornar a cerimônia executando itens
diretamente.

## Preview e reconciliação

Prepare um manifesto fora do repositório, usando apenas IDs e evidências oficiais
já aprovados. Execute explicitamente o dry-run:

```bash
pnpm mapping:reconcile --manifest ./mapping-manifest.reviewed.json --dry-run
```

O mesmo comando sem `--dry-run` continua sendo preview:

```bash
pnpm mapping:reconcile --manifest ./mapping-manifest.reviewed.json
```

O resumo padrão contém somente hashes, contagens, estado e totais por disposição.
Ele omite request IDs, IDs externos e IDs canônicos. Para investigar item a item,
grave um artefato restrito:

```bash
pnpm mapping:reconcile --manifest ./mapping-manifest.reviewed.json --dry-run \
  --detail ./mapping-preview.restricted.json
```

`--detail` cria um arquivo novo de modo exclusivo com permissão `0600`; não
sobrescreve arquivos existentes. O detalhe contém identificadores de mapping:
não o publique no PR, CI, logs ou chat. Guarde-o apenas no canal operacional
aprovado e aplique a política de retenção definida pelo owner de segurança.

O preview devolve `manifestSha256`, `planSha256`, `ready`, `conflictCount` e as
disposições agregadas. O hash do manifesto é calculado sobre JSON canônico e
independe da ordem original dos itens. O plano reflete o estado atual do banco;
qualquer mudança posterior invalida o hash esperado.

### Disposições

| Disposição         | Significado                                             |
| ------------------ | ------------------------------------------------------- |
| `create_verified`  | criaria nova identidade verificada sobre alvo existente |
| `promote_pending`  | promoveria pending que já aponta para o mesmo alvo      |
| `record_rejection` | registraria rejeição sem identidade ativa               |
| `reject_pending`   | rejeitaria e encerraria identidade pending              |
| `close_verified`   | encerraria identidade verificada; não apaga histórico   |
| `conflict`         | bloqueio; nenhum item do lote pode ser aplicado         |

### Reasons de conflito

| `reasonCode`                  | Ação de reconciliação segura                                       |
| ----------------------------- | ------------------------------------------------------------------ |
| `request_id_reused`           | gerar novo request ID após revisar a divergência                   |
| `mapping_owner_missing`       | obter owner oficial ativo; não inventar owner                      |
| `mapping_target_unavailable`  | validar alvo oficial existente e ativo                             |
| `mapping_authority_missing`   | obter aprovação formal e autoridade vigente                        |
| `mapping_authority_ambiguous` | remover ambiguidade por procedimento governado                     |
| `mapping_window_conflict`     | reconciliar vigências e evidências temporais                       |
| `active_mapping_conflict`     | revisar a versão ativa; não reapontar nem sobrescrever diretamente |

Com qualquer conflito, preserve `ready = false`, corrija a fonte ou a decisão
com evidência oficial e gere novo manifesto quando o conteúdo mudar. Nome,
semelhança textual, posição em relatório ou comportamento do sistema legado não
são prova de identidade.

## Cerimônia de apply

Apply só é permitido depois de revisão humana do manifesto e do detalhe do
preview, ausência de conflitos e aprovação dos dois hashes. Transfira os hashes
aprovados por canal confiável para variáveis locais não secretas:

```bash
CRM_MAPPING_IMPORT_APPLY_ENABLED=true \
pnpm mapping:reconcile --manifest ./mapping-manifest.reviewed.json --apply \
  --expected-plan-hash "${PLAN_SHA256_REVIEWED}" \
  --confirm-sha256 "${MANIFEST_SHA256_REVIEWED}" \
  --detail ./mapping-apply.restricted.json
```

As quatro travas são cumulativas:

1. `CRM_MAPPING_IMPORT_APPLY_ENABLED=true` vale somente para a invocação local;
2. `--confirm-sha256` deve ser o hash do manifesto canônico carregado;
3. `--expected-plan-hash` deve ser exatamente o plano aprovado no preview;
4. o banco exige autorização do reviewer e uma autoridade vigente com
   `apply_enabled = true` para cada item.

O banco reconstrói o plano sob locks. Plano alterado, conflito novo, owner
ausente, alvo inativo ou autoridade inválida abortam a transação inteira. Um
lote reapresentado com o mesmo batch ID e os mesmos hashes retorna noop; o mesmo
batch ID com conteúdo ou plano diferente falha fechado.

## Rollback lógico

Falha antes do commit produz rollback transacional automático. Depois de um
apply concluído, rollback não significa apagar linhas, editar tabelas privadas
ou restaurar dump. O histórico é preservado e a compensação usa novas decisões
auditadas:

1. desabilitar novas execuções locais mantendo
   `CRM_MAPPING_IMPORT_APPLY_ENABLED` ausente ou diferente de `true`;
2. se autorizado, suspender a autoridade correspondente no banco por processo
   separado; a CLI não altera autoridades;
3. preparar novo lote `reject`, com novos IDs, evidência e motivo oficiais, para
   encerrar a versão incorreta;
4. executar preview, reconciliar conflitos e aplicar pela mesma cerimônia;
5. se existir sucessor correto, preparar outro lote `verify` separado, com alvo
   já existente e vigência oficial posterior ao encerramento;
6. conferir auditoria, fila de reconciliação e consumidores antes de qualquer
   decisão de cutover.

Não use SQL direto, delete, update manual, reuse de request ID ou criação de
target/owner como atalho de rollback. Mappings corrigidos não autorizam por si
só rotação de caller, ativação do relay ou hardening destrutivo.

## Evidências de conclusão

Registre, sem copiar o detalhe para locais públicos:

- SHA-256 do manifesto e do plano aprovados;
- contagens por disposição e ausência de conflitos;
- referência da evidência do lote;
- reviewer e autoridade formal no canal auditável apropriado;
- resultado `noop` ou `appliedCount` esperado;
- decisão de rollback ou confirmação explícita de que ele não foi necessário.
