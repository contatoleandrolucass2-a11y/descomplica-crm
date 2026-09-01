# Runbook — provisionamento source-controlled de Master

## Objetivo e limite

O sistema aceita múltiplas identidades `master`, mas nenhuma delas pode ser
criada ou promovida pela interface, Route Handler, Server Action, Data API,
`authenticated` ou `service_role`. Cada autorização precisa existir no arquivo
versionado [`ops/access/master-provisioning.json`](../../ops/access/master-provisioning.json),
passar por revisão e ser executada pelo runner root-only do mesmo checkout.

O runner não cria conta, senha ou aceite legal. A pessoa precisa concluir o
cadastro normal, escolher a própria senha e aceitar as versões vigentes dos
Termos e da Política de Privacidade. Se a conta ou o ledger legal ainda não
existir, o provisionamento falha fechado sem alterar papéis.

## Contrato de segurança

- `public.bootstrap_master_user(uuid)` é `SECURITY DEFINER`, pertence a
  `postgres` e usa `search_path = ''`.
- `PUBLIC`, `anon`, `authenticated` e `service_role` não possuem `EXECUTE`.
- `public.user_roles` não aceita escrita direta por papéis da Data API.
- `public.can_assign_role` exclui `master`, mesmo para um Master existente.
- Cada identidade recebe papel Master, perfil aprovado e, quando o contrato de
  escopo existe, somente o escopo global ativo.
- A execução é serializada, idempotente e registrada em `audit_logs` com a
  referência da autorização e o SHA do checkout; e-mail, senha e token não
  entram na auditoria.
- A remoção da antiga unicidade não altera permissões de páginas nem concede
  acesso a papéis inferiores.

## Autorizar uma nova identidade no código

1. Confirme que a pessoa concluiu o cadastro normal no ambiente correto. Não
   crie a conta por SQL e não marque aceite legal em nome dela.
2. Normalize o e-mail com `trim` e caixa baixa e calcule SHA-256 localmente. O
   e-mail em claro não deve entrar no repositório, no comando nem no PR.
3. Adicione uma entrada única a `ops/access/master-provisioning.json`:
   ambiente, digest SHA-256, versões legais vigentes, `status=authorized` e uma
   `changeRef` no formato `master-<ambiente>-AAAA-MM-DD-NN`.
4. Inclua migration/pgTAP, documentação e testes do runner quando o contrato de
   banco mudar. Uma entrada adicional que reutilize o contrato já aprovado
   ainda exige PR, CI e deploy do arquivo versionado.
5. Não inclua UUID, e-mail, senha, token, URL de banco ou outro dado de acesso
   no Git.

## Preflight

O segredo de conexão administrativa deve estar em arquivo absoluto root-only,
regular, sem symlink, proprietário `root:root` e modo `0600`. O runner verifica
SHA exato e worktree limpa antes de abrir uma conexão. Ele retorna somente
booleans, estado do papel e contagens sanitizadas.

```bash
pnpm access:master preflight \
  --change-ref master-production-AAAA-MM-DD-NN \
  --database-url-file /caminho/root-only/database-url \
  --environment production \
  --expected-sha <SHA_DE_40_CARACTERES>
```

O preflight precisa comprovar:

- exatamente uma conta corresponde ao digest versionado;
- aceite legal das versões exatas existe;
- migration `20260901204113` está aplicada;
- a sessão administrativa é `postgres`;
- backup, restore isolado e janela de mudança foram aprovados à parte.

Se `targetExists=false`, a pessoa deve usar o cadastro normal. Não convide,
crie, redefina senha nem fabrique o ledger legal para contornar esse estado.

## Aplicação

Depois do backup e do preflight verde, execute no mesmo SHA. A confirmação não
é segredo; ela vincula ambiente, autorização e revisão.

```bash
pnpm access:master apply \
  --change-ref master-production-AAAA-MM-DD-NN \
  --database-url-file /caminho/root-only/database-url \
  --environment production \
  --expected-sha <SHA_DE_40_CARACTERES> \
  --confirm promote:master-production-AAAA-MM-DD-NN:<SHA_DE_40_CARACTERES>
```

Resultado esperado: `targetState=master`, contagem final maior em uma unidade,
ou `noop=true` quando a mesma identidade já estava completa. A saída nunca
contém e-mail, UUID, URL de banco ou material de autenticação.

## Verificação e rollback

Após aplicar, valide por consultas agregadas e por smoke autenticado da própria
pessoa: papel exibido, menu, URLs diretas, APIs, RLS, MFA/AAL2 e logout. Confirme
também que outro perfil não ganhou páginas e que o Master anterior continua
ativo.

Não existe downgrade automático para a migration que permite múltiplos Masters.
Uma identidade indevida deve ser removida por roll-forward source-controlled,
com backup e registro de auditoria; nunca apague logs. A aplicação pode voltar
para a imagem anterior sem reabrir um caminho público de elevação.

## Referências

- `supabase/migrations/20260901204113_multi_master_source_controlled.sql`
- `supabase/tests/multi_master_source_controlled.test.sql`
- `ops/access/provision-master.mjs`
- `ops/access/master-provisioning.json`
