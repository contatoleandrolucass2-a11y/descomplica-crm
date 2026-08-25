# Imagem única e configuração de runtime

## Contrato

Homologação e produção consomem exatamente `descomplica-crm:<SHA completo>`.
Nenhum Compose possui `build:`; a imagem é construída uma vez por
`pnpm image:build`, recebe `org.opencontainers.image.revision` e só pode ser
criada com worktree limpa e `IMAGE_TAG` igual ao `HEAD`.

Configurações específicas são injetadas ao iniciar o mesmo artefato:

- `DEPLOYMENT_VERSION`, `APP_ORIGIN`, `HOMOLOGATION_MODE` e
  `PUBLIC_SIGNUP_ENABLED`;
- `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`, ambas lidas somente no servidor;
- flags existentes, desligadas por padrão;
- `AUTH_SESSION_COOKIE_SECRET_FILE`, fixo em
  `/run/secrets/auth_session_cookie_secret`.

Não há `NEXT_PUBLIC_SUPABASE_*`, `APP_ORIGIN`, modo de homologação ou flag de
cadastro entre os argumentos de build. Se um cliente Supabase no browser for
necessário no futuro, um Server Component deverá entregar explicitamente a
dupla pública validada; não deve reintroduzir ambiente compilado.

## Secret store

Cada ambiente mantém HMAC próprio:

- produção:
  `/etc/descomplica-crm/secrets/production-auth-session-cookie-secret`;
- homologação:
  `/etc/descomplica-crm/secrets/homologation-auth-session-cookie-secret`.

Diretório é `root:root 0710`; arquivos são `root:root 0640`. Nenhum usuário do
host fora do grupo root pode listar ou ler conteúdo. Wrapper
`compose-with-runtime-secret.mjs` valida caminho fixo, ownership, modos e
conteúdo sem eco. Compose monta arquivo read-only em `/run/secrets`; processo
não-root recebe somente grupo suplementar `0`, sem capacidades Linux, para ler
esse mount. Valor nunca entra no arquivo de ambiente, imagem, Git, process env
ou linha de comando.

Os arquivos `/etc/descomplica-crm/production.env` e
`/etc/descomplica-crm/homologation.env` são `root:root 0600`. Caminhos
simbólicos, owners ou modos divergentes falham antes de invocar Compose. O
wrapper não herda o ambiente do chamador: o subprocesso recebe somente `PATH`
fixo e `DOCKER_HOST=unix:///var/run/docker.sock`. Assim variáveis do shell não
podem sobrepor o arquivo já validado pelo mecanismo de precedência do Compose.
Manifest e diretório de trabalho são resolvidos a partir da localização
versionada do wrapper, nunca do diretório corrente do chamador.

Os configuradores preservam segredo válido e criam substituto aleatório de
forma atômica apenas quando ausente ou inválido. Não imprimem conteúdo. O
container rejeita segredo direto em `AUTH_SESSION_COOKIE_SECRET`, arquivo
ausente, conteúdo menor que 32 bytes, `APP_ORIGIN` sem HTTPS, SHA incompleto e
contrato Supabase inválido antes de iniciar o Next.js.

## Prova

Após congelar o SHA final:

```bash
IMAGE_TAG="$(git rev-parse HEAD)" pnpm image:build
IMAGE_TAG="$(git rev-parse HEAD)" pnpm image:prove
```

`image:prove` renderiza ambos os Compose com fixtures não sensíveis, confirma a
mesma referência, confere o image ID e label OCI e executa o validador interno
com dois perfis de runtime sobre a mesma imagem. A saída contém apenas imagem,
digest, contagens e booleanos; nenhum segredo.

Promoção usa wrapper root-only e nunca recompila:

```bash
sudo node scripts/release/compose-with-runtime-secret.mjs homologation up -d --no-build --remove-orphans
sudo node scripts/release/compose-with-runtime-secret.mjs production up -d --no-build --remove-orphans
```

O wrapper aceita somente `config --quiet`, `up -d --no-build
--remove-orphans`, `ps`, `stop` e `down --remove-orphans`; flags adicionais são
rejeitadas.

### Trade-off do mount

O runtime atual do Docker Compose aceita segredo de arquivo, mas não materializa
`secrets.environment`, e ignora `uid`, `gid` e `mode` da sintaxe longa quando a
fonte é arquivo. Um arquivo host `root:root 0600` torna-se, portanto, ilegível
para o processo `node` não-root. O contrato usa bind explícito `read_only`,
arquivo host `root:root 0640` e somente o grupo suplementar `0` no container.
Como compensações, o diretório é `0710`, o wrapper root-only confere caminho,
owner, modo e conteúdo, `create_host_path` fica falso, todas as capabilities são
removidas e `no-new-privileges` permanece ativo. `image:prove` exercita esse
mount real; uma futura secret store nativa pode substituir o bind sem alterar a
interface `_FILE` da aplicação.

Antes de produção, comparar image ID registrado após homologação. Divergência
interrompe gate.

Rollback reaponta ambos os Compose para a tag e image ID anteriores, preserva
secret stores e não altera banco. Migrations aditivas já aplicadas exigem
roll-forward; nunca rollback destrutivo.
