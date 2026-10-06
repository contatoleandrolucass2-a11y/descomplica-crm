# MCPs de desenvolvimento locais

Verificado em 2026-09-28. Escopo: este checkout, Windows e Linux, desenvolvimento
em loopback. Instalacao nao significa autenticacao, autorizacao para dados remotos,
conexao com o app atual, publicacao ou teste de navegador aprovado.

## Pacotes e comandos

| devDependency fixa           | Origem oficial                                                          | Bin local utilizado                    |
| ---------------------------- | ----------------------------------------------------------------------- | -------------------------------------- |
| `next-devtools-mcp@0.4.0`    | [Vercel](https://github.com/vercel/next-devtools-mcp)                   | `dist/index.js`                        |
| `chrome-devtools-mcp@1.10.1` | [ChromeDevTools](https://github.com/ChromeDevTools/chrome-devtools-mcp) | `build/src/bin/chrome-devtools-mcp.js` |

As dependencias sao justificadas pelos comandos `devtools:next`, `devtools:chrome`
e pelos servidores stdio em `.codex/config.toml`. Nao integram o bundle do CRM.
O launcher resolve `bin` do `package.json` instalado, confere a versao e executa
o arquivo com Node, sem shell, npx, download em startup ou instalacao global.
`agent-browser` nao e instalado. O checker reutiliza o SDK de protocolo ja
distribuido como dependencia do Next MCP.

Na raiz do checkout, com Node 24.19.x e pnpm 11.20.x:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm devtools:check
pnpm exec vitest run tests/project-devtools.test.ts
pnpm audit --json
```

`--ignore-scripts` foi usado nesta instalacao incremental. Nao substitui o
bootstrap normal do CRM em uma maquina nova, onde outros pacotes podem precisar
dos scripts de build ja autorizados pelo projeto.

`pnpm devtools:next` e `pnpm devtools:chrome` iniciam servidores stdio e aguardam
um cliente MCP; nao sao comandos de diagnostico que imprimem um resultado e saem.
Use `pnpm devtools:check` para a verificacao finita: negocia o protocolo, lista
ferramentas e chama somente `nextjs_docs`, que consulta metadados locais.

No Windows deste ambiente, o comando equivalente com runtime explicito e:

```powershell
$devtoolsNode = 'C:/Users/Leandro Lucas/AppData/Local/Codex/runtimes/node-v24.19.0-win-x64/node.exe'
$devtoolsPnpm = 'C:/Users/Leandro Lucas/AppData/Roaming/npm/node_modules/pnpm/bin/pnpm.cjs'
$env:PATH = (Split-Path $devtoolsNode) + ';' + $env:PATH
& $devtoolsNode $devtoolsPnpm devtools:check
& $devtoolsNode $devtoolsPnpm exec vitest run tests/project-devtools.test.ts
& $devtoolsNode $devtoolsPnpm audit --json
```

O launcher aceita apenas `next` ou `chrome`, sem flags adicionais. No Windows,
se o Node inicial nao for 24.19.x, procura e verifica
`%LOCALAPPDATA%/Codex/runtimes/node-v24.19.0-win-x64/node.exe`. Isso nao instala nem
atualiza runtimes. No Linux, Node 24.19.x precisa estar no PATH. O processo MCP
recebe esse mesmo runtime na frente do PATH, inclusive para subprocessos.

## Configuracao do Codex

Abrir um novo chat na raiz deste checkout apos instalar as dependencias. A
configuracao e local ao projeto e nao modifica trust, approval, sandbox ou a
configuracao global. Se a politica atual nao carregar a camada do projeto,
nao contornar a restricao. Este trabalho nao altera nem recarrega a conexao do
chat atual.

Os campos `command`, `args`, `env`, `startup_timeout_sec` e `enabled_tools` seguem
a [referencia oficial do Codex](https://learn.chatgpt.com/docs/config-file/config-reference).
`cwd` e omitido para herdar o diretorio do chat, evitando caminhos absolutos de
uma maquina ou worktree. Os argumentos do launcher partem da raiz; seu processo
filho fixa o cwd pela localizacao do proprio script. Iniciar o chat em uma
subpasta com esse argv relativo nao e suportado.

Verificacao somente da leitura da configuracao, sem iniciar MCPs:

```sh
codex mcp get next-devtools --json
codex mcp get chrome-devtools --json
```

## Ferramentas expostas

Next: `nextjs_index`, `nextjs_call`, `nextjs_docs`. `browser_eval` permanece fora
da allowlist. Os dois primeiros acessam o endpoint de desenvolvimento Next;
`nextjs_docs` aponta para a documentacao local da versao instalada. A descoberta
pode encontrar outros servidores Next locais: confirmar a porta e os metadados
do projeto antes de consultar. O host e fixado em `127.0.0.1`.

Chrome: a allowlist possui 11 ferramentas:

| Finalidade                              | Ferramentas                                                                        |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| Preparar e fechar o alvo de diagnostico | `list_pages`, `new_page`, `navigate_page`, `close_page`                            |
| Console                                 | `list_console_messages`, `get_console_message`                                     |
| Rede                                    | `list_network_requests`, `get_network_request`                                     |
| Performance                             | `performance_start_trace`, `performance_stop_trace`, `performance_analyze_insight` |

Navegacao serve apenas para preparar o alvo local da coleta. Traces podem
recarregar a pagina e gravar artefatos; nao sao operacoes puramente de leitura.
Nao expor screenshots, snapshots, clique, preenchimento, avaliacao JavaScript,
Lighthouse, memoria, emulacao, PWA, extensoes, WebMCP ou ferramentas da pagina.
Controle de interface de navegador continua pelo CUA.

`enabled_tools` e um filtro do cliente Codex: `tools/list` bruto do pacote Next
ainda anuncia `browser_eval`; o Chrome anuncia ferramentas adicionais de suas
categorias ativas. Outro cliente que ignore essa allowlist nao recebe as mesmas
restricoes. O teste confere que cada nome permitido existe no protocolo real.

## Rede e dados

Flags fixas de Chrome: `--headless`, `--isolated`, `--no-performance-crux`,
`--no-usage-statistics`, `--redact-network-headers`, `--no-javascript-evaluation`
e categorias input, emulation, memory, extensions, experimental-third-party,
experimental-webmcp e pwa desativadas explicitamente.

`--allowed-url-pattern` aceita somente `http://127.0.0.1:*/*`,
`http://localhost:*/*` e seus equivalentes `ws://` para HMR. Nao aceita LAN,
dominios remotos, HTTPS, arquivos, `data:`, `javascript:` ou paginas internas.
O help de 1.10.1 exige **Chrome 149+** para essa restricao, aplicada a navegacao
e subrecursos. Nao remover o filtro para acomodar Chrome antigo. Subrecursos
externos bloqueados podem afetar a fidelidade do diagnostico.

Nao ha autoConnect, browserUrl, wsEndpoint, perfil persistente, credenciais,
proxy, extensoes, bypass TLS ou desativacao de sandbox do Chrome. A primeira
ferramenta de navegador pode abrir um Chrome headless isolado; o boot MCP e
`initialize/tools/list` nao precisam abrir esse navegador.

O launcher copia apenas variaveis essenciais do sistema e impoe:

```text
NEXT_TELEMETRY_DISABLED=1
NEXT_DEVTOOLS_HOST=127.0.0.1
CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS=1
CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS=1
```

Nao carrega `.env*`, nem repassa tokens, variaveis do CRM, proxies, certificados
customizados ou `NODE_OPTIONS`. A filtragem nao e um sandbox de filesystem.
Redacao de headers nao remove segredos de URLs, corpos, console ou traces.
Usar apenas dados sinteticos locais; nunca enviar credenciais, clientes,
propostas ou estoque real. Loopback pode servir como proxy para backends remotos:
esta configuracao nao controla o servidor Next nem autoriza acesso remoto
indireto. A telemetria do processo de desenvolvimento Next iniciado separadamente
tambem precisa de sua propria configuracao; o launcher nao muda esse processo.

## Evidencias e pendencias

Instalacao incremental: `pnpm install --ignore-scripts`, Node 24.19.0 e pnpm
11.20.0. Duas dependencias diretas adicionadas e Vitest atualizado para 4.1.11,
correcao revisada no PR #65. O SDK transitivo do Next foi fixado em 1.30.1 por
override restrito a esse pacote em pnpm-workspace.yaml, sem suprimir alertas.

Os 24 testes de `tests/project-devtools.test.ts` passaram com Vitest 4.1.10;
ESLint passou em `devtools.mjs`, `devtools-check.mjs` e no arquivo de testes.
O import ESM do teste usa namespace em uma linha para manter `@ts-expect-error`
na linha correta apos Prettier. A verificacao TypeScript isolada do arquivo
passou com `--noEmit --strict --skipLibCheck --target ES2022 --module esnext
--moduleResolution bundler --esModuleInterop --types node`.
Nao restaram processos desses MCPs apos os testes. Esses resultados antecedem
o override do SDK e o patch Vitest coordenados em paralelo; repetir o checker
e a suite focada apos a integracao para medir a compatibilidade.

Boot e protocolo `initialize` + `tools/list` passaram para Next 0.4.0 e Chrome
1.10.1 no Windows. O checker tambem exige resposta `use_bundled_docs` com docs
disponiveis de `nextjs_docs`. O fallback do Node global 25.7.0 para o bundled 24.19.0 foi
exercitado. Os testes verificam filtragem de ambiente, flags no parser publicado,
padroes de URL, resolucao do runtime Windows/Linux e listas do config. Execucao
nativa Linux e diagnostico com Chrome 149+ continuam pendentes; testes de
protocolo nao comprovam bloqueio real da rede do navegador.

Depois da correcao, `pnpm audit --audit-level low` e `pnpm security:osv` passaram
sem vulnerabilidades conhecidas; OSV verificou 610 pacotes apos alinhar o lockfile ao PR #65. Protocolo e docs MCP
retestados com SDK 1.30.1. O [advisory oficial](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-345p-7cg4-v4c7)
descreve a correcao a partir de 1.26.0; nenhuma excecao de auditoria foi adicionada.
Os 24 testes tambem passaram na suite completa com Vitest 4.1.11.

Codex CLI leu os dois servidores habilitados com suas allowlists. Next dev foi
iniciado em 127.0.0.1:3137, telemetria desligada; `nextjs_index` encontrou o alvo
e `get_project_metadata` confirmou este checkout. A pagina local reportou falta
de configuracao Supabase, esperada neste checkout sem .env.local. Nao se copiou
credencial de producao nem se contornou o guard. A CI fornece o ambiente
sintetico isolado para os gates completos. Nenhum deploy foi realizado.

## Revalidacao do SDK em 06/10/2026

O override restrito ao Next DevTools usa agora SDK 1.31.0, correcao do
[GHSA-6qxp-vccf-f47h](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-6qxp-vccf-f47h).
O registro anterior de 1.30.1 e historico. Nenhuma flag, conta, permissao ou
allowlist foi ampliada. `pnpm devtools:check` aprovou initialize, tools/list e
docs locais; 24 testes de DevTools aprovados com o novo SDK. Auditoria sem
vulnerabilidades conhecidas. Validacao Linux segue exigida na CI do PR #156.

## Fontes

- [npm: Next 0.4.0](https://registry.npmjs.org/next-devtools-mcp/0.4.0).
- [npm: Chrome 1.10.1](https://registry.npmjs.org/chrome-devtools-mcp/1.10.1).
- [Documentacao oficial Next MCP](https://nextjs.org/docs/app/guides/mcp).
- [ChromeDevTools: release 1.10.1](https://github.com/ChromeDevTools/chrome-devtools-mcp/tree/chrome-devtools-mcp-v1.10.1).
- Help e parser do pacote Chrome instalado, `build/src/config/mcp-options.js`.
- [Codex: configuracao por projeto](https://learn.chatgpt.com/docs/config-file/config-basic).
