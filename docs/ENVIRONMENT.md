# Ambiente de desenvolvimento

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

## Diagnóstico

- Se `node -v` mostrar Node 26, execute `nvm use` antes de instalar dependências.
- Se `supabase start` falhar, confirme que o daemon Docker está ativo e que as portas 54320–54324 estão livres.
- Se o lockfile mudar em instalação congelada, pare e verifique versão do pnpm e `packageManager`.
- Se um script de instalação for bloqueado, revise sua necessidade; não amplie `allowBuilds` automaticamente.
