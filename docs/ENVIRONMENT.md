# Ambiente de desenvolvimento

## Simuladores oficiais

- `OFFICIAL_SIMULATOR_RUNTIME_MODE`: `off` por padrão; único valor habilitador:
  `active`.
- `OFFICIAL_SIMULATOR_ENABLED_KEYS`: allowlist separada por vírgulas. Valores
  conhecidos: `simulator.wf13`, `simulator.wf16`, `simulator.caixa`,
  `simulator.wf14` e `simulator.wf15`.

Modo inválido, allowlist vazia, duplicada ou com chave desconhecida falha
fechado. Essas variáveis não carregam segredo e não substituem autorização no
banco/servidor.

## Matriz validada

| Ferramenta        |  Versão | Origem/decisão                               |
| ----------------- | ------: | -------------------------------------------- |
| macOS             |   arm64 | máquina de preparação                        |
| Git               |  2.50.1 | Apple Git disponível                         |
| GitHub CLI        |  2.97.0 | Homebrew                                     |
| NVM               |  0.40.6 | Homebrew, carregado por `.zshrc`             |
| Node.js           | 24.19.0 | NVM, LTS fixado em `.nvmrc`                  |
| npm               | 11.17.0 | acompanha Node; não gerencia o projeto final |
| pnpm              | 11.20.0 | Corepack, fixado em `packageManager`         |
| Docker Engine     |  29.4.3 | Docker Desktop                               |
| Docker Compose    |   5.1.4 | Docker Desktop                               |
| Supabase CLI      | 2.111.0 | tap oficial + dependência de projeto         |
| PostgreSQL client |    18.4 | `libpq` via Homebrew                         |
| Gitleaks          |  8.30.1 | Homebrew                                     |
| OSV-Scanner       |   2.4.0 | Homebrew                                     |
| actionlint        |  1.7.12 | Homebrew; valida workflows GitHub Actions    |
| ShellCheck        |  0.11.0 | Dependência do actionlint; valida shell      |

## Configuração de shell no macOS

O ambiente preparado carrega `brew shellenv`, define `NVM_DIR` explicitamente, carrega o NVM e inclui o `libpq/bin` no `PATH`. Valide uma nova sessão com:

```bash
zsh -lic 'node -v; pnpm -v; nvm --version; psql --version'
```

## Reconstrução

1. Instalar ferramentas oficiais listadas no README.
2. Clonar o repositório público.
3. Executar `nvm install && nvm use`.
4. Ativar `pnpm@11.20.0` com Corepack.
5. Abrir Docker Desktop.
6. Executar `pnpm install --frozen-lockfile`.
7. Criar `.env.local` a partir do exemplo, sem copiar credenciais legadas.
8. Executar `pnpm db:start` e o conjunto de validação obrigatória.

## Extensões e integrações do Codex

Não foi necessária extensão de editor para compilar ou testar. As capacidades locais usadas foram terminal, Git, Docker, scanners e documentação oficial. Supabase e GitHub são tratados por CLIs oficiais; credenciais não são armazenadas pelo projeto.

## Relay Qlik e mappings

O runtime aceita somente variáveis server-side e permanece inerte por padrão:

```dotenv
QLIK_RELAY_MODE=off
QLIK_RELAY_WRITE_ENABLED=false
QLIK_RELAY_KEY_ID=
QLIK_RELAY_HMAC_SECRET=
QLIK_RELAY_DATABASE_URL=
CRM_MAPPING_IMPORT_ACCESS_TOKEN=
CRM_MAPPING_IMPORT_APPLY_ENABLED=false
```

`QLIK_RELAY_DATABASE_URL` deve usar exclusivamente o usuário
`crm_qlik_relay` (ou seu sufixo de pooler), TLS `sslmode=verify-full` e senha
privada. `postgres`, `service_role` e conexões administrativas são rejeitados.
O segredo HMAC e a senha PostgreSQL devem ser obrigatoriamente distintos;
reutilização faz a configuração falhar fechada.
Shadow exige write `false`; canary/active exigem write `true`, além do gate no
banco. O token humano de mapping deve vir de sessão Master dedicada, somente
por ambiente, nunca por argumento. Apply permanece bloqueado sem confirmação
dos dois hashes e a flag separada.

## Runtime de políticas comerciais

```dotenv
COMMERCIAL_ENGINE_RUNTIME_MODE=off
COMMERCIAL_ENGINE_ENABLED_KEYS=
COMMERCIAL_ENGINE_DATABASE_URL=
```

Valores aceitos para o modo são `off`, `shadow` e `active`; valor desconhecido
vira `off`. Shadow/active sem allowlist exata também ficam indisponíveis. A
allowlist aceita apenas as 14 chaves do catálogo e duplicata/entrada desconhecida
invalida a configuração inteira. Shadow/active também exigem
`COMMERCIAL_ENGINE_DATABASE_URL` com TLS `sslmode=verify-full`, senha de pelo
menos 16 caracteres e usuário exato `crm_commercial_engine` (ou seu sufixo de
pooler). Host direto e sufixo do usuário no pooler devem corresponder ao mesmo
project ref de `NEXT_PUBLIC_SUPABASE_URL`; ausência ou divergência falha fechada.
Usuário administrativo, parâmetros extras, host não Supabase em produção ou
senha reutilizada de Supabase/Qlik invalidam a configuração. Essas variáveis
são server-only.

O configurador de produção fixa `off`, lista e URL vazias neste incremento. Ele
não oferece prompt de ativação. A migration cria `crm_commercial_engine` como
`NOLOGIN`, sem senha, acesso a tabelas/sequences ou membership utilizável; apenas
os dois entrypoints no schema `commercial_engine` são concedidos. Uma futura
habilitação exige provisionamento privado e prova de isolamento do papel,
mudança versionada e autorizada, policy, casos de ouro, permissão e gate no
banco; editar o arquivo de ambiente isoladamente não basta.

## Diagnóstico

- Se `node -v` mostrar Node 26, execute `nvm use` antes de instalar dependências.
- Se `supabase start` falhar, confirme que o daemon Docker está ativo e que as portas 54320–54324 estão livres.
- Se o lockfile mudar em instalação congelada, pare e verifique versão do pnpm e `packageManager`.
- Se um script de instalação for bloqueado, revise sua necessidade; não amplie `allowBuilds` automaticamente.
