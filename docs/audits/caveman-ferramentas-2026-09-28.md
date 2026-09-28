# Caveman, diagnosticos e revisao do estoque

status: validado_local (gates Linux vinculados ao PR; nao publicado)
atualizado_em: 2026-09-28
fonte: branch codex/caveman-auditoria-recursos; documentacao oficial; npm;
Chrome autenticado em leitura; testes com dados sinteticos

## Decisoes de recursos

| Recurso                                                | Decisao                                     | Motivo e limite                                                                                        |
| ------------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Caveman Lite, Cavecrew e sete skills locais            | Integrar na matriz e nos sete perfis crm-\* | Concisao com evidencias completas; nao altera calculos, autorizacoes ou instrucoes superiores.         |
| Sete capacidades Caveman globais adicionais            | Roteamento condicional                      | Disponibilidade local nao significa Cloud conectado, CLI funcional ou economia medida.                 |
| Next DevTools MCP                                      | Instalar versao npm 0.4.0, fixa             | Erros, rotas e documentacao correspondente ao Next local; somente desenvolvimento.                     |
| Chrome DevTools MCP                                    | Instalar versao npm 1.10.1, fixa            | Diagnostico de rede/performance em navegador isolado local; sem CrUX, telemetria ou perfil pessoal.    |
| Playwright, axe, Vitest, pgTAP, Gitleaks e OSV         | Reutilizar verificacoes existentes          | Evitar duplicar a suite e preservar gates de acesso, dados e release.                                  |
| Vitest 4.1.11                                          | Integrar PR Dependabot #65                  | Correcao de advisory; nao migrar automaticamente ao major 5.                                           |
| Context7                                               | Opcional, nao instalado                     | Catalogo o encontrou; documentacao Next da versao instalada e fontes oficiais ja atendem esta demanda. |
| Vercel connector                                       | Nao instalar para esta demanda              | CRM usa VPS; conector nao melhora a consulta de estoque nem exige migrar hospedagem.                   |
| Figma, Supabase, PostHog, Datadog e Codex Security     | Selecionar quando pertinentes               | Instalar nao autentica nem configura telemetria; manter contas e permissao especificas.                |
| Caveman Cloud/proxy e conversao de skills para imagens | Nao ativar                                  | Encaminhamento de prompts/dados e mudanca de representacao exigem avaliacao e autorizacao especificas. |
| Caveman Code                                           | Nao instalar                                | Fork congelado em agosto/2026; nao confundir com o projeto Caveman mantido.                            |
| Outro framework, banco ou automacao de navegador       | Nao adicionar                               | Nao existe requisito tecnico que justifique substituir Next/Supabase/CUA/Playwright.                   |

Fontes primarias consultadas:

- [Caveman](https://github.com/JuliusBrussee/caveman) e
  [Caveman Code](https://github.com/JuliusBrussee/caveman-code).
- [Next DevTools](https://github.com/vercel/next-devtools-mcp) e
  [MCP do Next](https://nextjs.org/docs/app/guides/mcp).
- [Chrome DevTools](https://github.com/ChromeDevTools/chrome-devtools-mcp) e
  [configuracao e privacidade](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/configuration.md).
- [React best practices](https://vercel.com/blog/introducing-react-best-practices) e
  [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines).
- [Configuracao do Codex](https://learn.chatgpt.com/docs/config-file/config-reference).
- [Advisory Vitest](https://github.com/advisories/GHSA-82fw-gwwq-j7x9).

A versao publicada no npm prevalece sobre a versao ainda presente apenas no
repositorio upstream. Nao executar instaladores de blogs/videos nem usar @latest
na inicializacao de cada chat. A pesquisa nao certifica que toda ferramenta
existente foi descoberta; a selecao considera utilidade, origem e verificacao.

## Revisao da aplicacao

A auditoria anterior mapeou 40 arquivos de rota/API em nove areas e abriu 19
rotas de producao. Esta rodada revalida o Associativo e os estados centrais do
CRM, com aprofundamento no carregamento/estado do estoque. Nao repete testes
destrutivos, propostas reais, alteracoes de acesso ou chamadas de workflows.

O Associativo carregou em producao, sem erros capturados no console. Nao houve
overflow horizontal global em 375x812, 768x1024, 1024x768 e 1440x900. Screenshot
mobile inspecionado; os demais tamanhos tambem tiveram geometria DOM conferida.
Isso nao prova ausencia de sobreposicao, conformidade WCAG integral ou latencia
de todas as jornadas. A data mostrada pela fonte foi preservada sem inferir uma
politica de atualizacao inexistente. Nenhum estoque bruto foi exportado.

| Gravidade               | Achado                                                                                   | Correcao e aceite                                                                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2                      | Filtros/limpeza removiam a selecao no Associativo e Investidor; reselecao zerava valores | Preservar selecao e proposta em todos os modos; teste de navegador preenche campos, filtra unidade para fora da lista e limpa sem perda.                |
| P2                      | Filtrar/ordenar/limpar marcava proposta iniciada e bloqueava a resposta viva tardia      | Bloquear substituicao somente apos selecionar unidade; teste de navegador segura a resposta viva enquanto explora filtros e exige sua aplicacao depois. |
| P3                      | Requisicoes frias concorrentes repetiam leitura/hash/parse do snapshot                   | Compartilhar promessa; testar uma leitura, autorizacao por chamada, cache quente e nova tentativa apos falha.                                           |
| Configuracao de negocio | Dashboard/metas e fontes relacionadas continuam com estados indisponiveis                | Nao substituir ausencias por zeros nem remover gates; exige fonte oficial, conciliacao e politica aprovada.                                             |

Nao foi estabelecido um benchmark de TTFB/LCP/INP de producao nem percentual de
melhora. A reducao comprovavel neste patch e de leituras concorrentes no teste,
nao uma promessa de velocidade ponta a ponta. Arquivos de autoridade permanecem
integrais; Obsidian recebe somente os registros curados do projeto.

## Verificacao

- Windows, Node 24.19.0 e pnpm 11.20.0: lint, typecheck, inventario, protocolo
  dos dois MCPs e documentacao Next passaram. Full Vitest 4.1.11: 806 aprovados,
  seis falhas POSIX preexistentes e um skip preexistente; oito testes Node
  Salesforce passaram separadamente. Nenhuma assercao POSIX foi enfraquecida.
- Testes novos: 21 do snapshot e 24 dos devtools; inventario inclui omissao de
  skill/matriz. Regressao de navegador cobre filtros, resposta viva durante
  exploracao e resposta que remove a unidade apos iniciar proposta.
- pnpm audit em nivel low e OSV (610 pacotes apos integrar o lockfile do PR #65) passaram sem achados conhecidos;
  Gitleaks passou. Corrigido tambem o SDK transitivo do Next MCP, 1.25.2 para
  1.30.1, por override restrito e protocolo retestado, sem ignorar advisory.
- Next dev respondeu em 127.0.0.1:3137; MCP confirmou o checkout e identificou
  corretamente falta da configuracao Supabase local. Nao copiar credenciais
  reais para resolver ambiente de QA; jornadas autenticadas usam CI isolada.
- Revisao independente pediu cobertura de resposta tardia apos proposta;
  acrescentada. Nao apontou outro bug funcional confirmado no recorte lido.
- Build e formatacao locais passaram. CI no SHA final do [PR #101](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/101). Gates verdes
  nao significam publicacao. Nenhuma mudanca desta branch foi aplicada ao site
  de producao durante a inspecao.
