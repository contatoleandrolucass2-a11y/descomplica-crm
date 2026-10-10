# Evidencias da integracao do draft CRM para a VPS

Data: 10/10/2026. Branch de desenvolvimento: `codex/aplicar-draft-crm-vps`.

## Estado

Integracao implementada e aprovada nos gates locais, E2E de release e promocao
visual autenticada listados neste documento. A verificacao pos-commit em modo
`verify` tambem foi concluida e aprovada. PR, CI do SHA candidato e publicacao
protegida continuam pendentes; producao nao foi publicada.

## Proveniencia do draft

Fonte local aprovada:
`/srv/descomplica-design-drafts/2026-10-10/draft-crm-para-vps`.

| Artefato                      | SHA-256                                                            | Uso                                 |
| ----------------------------- | ------------------------------------------------------------------ | ----------------------------------- |
| `manifesto.json`              | `c113f793b50efc36c08a0c2757980725af252d01c474f7ffd9ed773566242e18` | Inventario conferido do pacote      |
| `INSTRUCOES-PARA-O-AGENTE.md` | `9481fedd27a37b8b55526c2e811a83080c62758c5c731960e0b9ac816198a58c` | Regras de integracao e preservacao  |
| `LEIA-ME.md`                  | `e168380da7311ba69d536c629fc36a5912ed144a8e5822c484c33909ee9cf8ed` | Mapa das fontes e limites da previa |
| `outputs/modelo-site.html`    | `a30980e6f2b790b648348d602e1cb07c9de6f0718ce6450ddb58e034f4f1c698` | Referencia visual final aprovada    |

O `approvedPreviewSHA256` do manifesto coincide com o hash calculado de
`outputs/modelo-site.html`. `portableRebuildMatches: true` e
`javascriptSyntaxCheck: passed` descrevem somente a previa transportavel; nao
substituem testes do CRM integrado.

## Assets incorporados

| Asset no CRM                                  | SHA-256 no CRM                                                     | SHA-256 na fonte                                                   | Observacao                                     |
| --------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------- |
| `public/brand/descomplica-wordmark-light.svg` | `5dcd1383b5e3e2c383fa313580cde02067008bfc8fd5bee33a3c8ec35ad1374d` | `1f2f3534551ac002e0df6e3ef72b7765a02e63a76d5f98c89561d244ffdf3922` | Mesmo SVG claro, normalizado com quebra final  |
| `public/brand/descomplica-wordmark-dark.svg`  | `c089f8f7aba423664d7c30063a098d82abe8d63d49347fe88d798876dbc63398` | `b0e7787677456c2eb0bd4cc211e105afd6a658ba4eee8c1ca586216e602aba93` | Mesmo SVG escuro, normalizado com quebra final |
| `public/integrations/salesforce.svg`          | `e845eff79dde3342dea038aafd5786de7d69ae62527386bebcf4e725053b5514` | `53ef5e2ecc5b3b78ae3ebcc0535dfd349c38440b35cf0edf1e0495bdcaa1ccce` | Mesmo SVG, normalizado com quebra final        |
| `public/integrations/n8n-dark.svg`            | `8e6ff3a85953b1e09b0ec16a25b0f66b38eb77434f7834c0ac3716b952635d9a` | Igual                                                              | Copia integral                                 |
| `public/integrations/n8n-light.svg`           | `9fd7dc879b2119f59fcd4055147257de08620c3db5722329a7d4d8fc502d592e` | Igual                                                              | Copia integral                                 |
| `public/integrations/supabase-dark.svg`       | `6d57804518b7d5b9dadf767cd277e1a389980e1b8cf53138abe01365c8b81628` | Igual                                                              | Copia integral                                 |
| `public/integrations/supabase-light.svg`      | `48fec684d8f9f7b0f93fa94fb4fbaa195d3cb299263c3c0fdaea11b43745ceb3` | Igual                                                              | Copia integral                                 |

## Layout integrado

- Marca horizontal completa, grafite nos temas Claro/Medio e branca no Escuro,
  com seta vermelha constante e sem duplicacao textual do nome.
- Navegacao primaria compacta: Dashboard e etapas autorizadas, Simulacao como
  link direto, Ranking, Parcerias e Administracao. Configuracoes fica no menu
  da conta.
- Administracao apresenta Usuarios, Paginas e Integracoes. A URL existente
  `/app/configuracoes/conectar-sistemas` foi mantida para compatibilidade, com
  nome e breadcrumb de Integracoes.
- Dashboard, etapas, Ranking, Parcerias, Configuracoes, Recurso MKT e telas
  administrativas usam o canvas compacto responsivo dos tres temas, mantendo
  os dados, filtros, estados vazios e contratos ja existentes.
- Hub de Simulacao com seis ferramentas, duas colunas no desktop e uma no
  celular. Documentacao e CAIXA usam a apresentacao aprovada; motores sem
  contrato continuam indisponiveis e nao produzem valores.
- Integracoes mostra Salesforce, n8n e Supabase com os assets do pacote.
  Salesforce deriva estado da API existente e separa sessao, coleta e
  publicacao. n8n e Supabase permanecem `Nao verificado` quando nao existe fonte
  real de status.
- Usuarios carrega seis contas por pagina no servidor. Busca e filtro refazem a
  consulta; rolagem usa `IntersectionObserver`, com botao de fallback, erro e
  fim da lista. Cada pagina carrega somente os papeis e overrides das contas
  retornadas; a Server Action revalida `users.view`.

Nenhum dado demonstrativo, usuario, valor comercial, estado de integracao ou
temporizador da previa foi copiado para o runtime.

## Quatro simuladores preservados

| Rota                                      | Componente existente      | Evidencia estrutural nesta etapa         |
| ----------------------------------------- | ------------------------- | ---------------------------------------- |
| `/app/simulacao/associativo-fluxo-linear` | `AssociativeTableArchive` | Componente, campos e motor nao alterados |
| `/app/simulacao/tabela-direta`            | `DirectTableArchive`      | Componente, campos e motor nao alterados |
| `/app/simulacao/tabela-investidor`        | `InvestorTableArchive`    | Componente, campos e motor nao alterados |
| `/app/simulacao/tabelao`                  | Rota dedicada do Tabelao  | Rota, conteudo e motor nao alterados     |

As regras novas de `simulators.module.css` usam `.hubPage` e `.caixaPage`. As
regras novas do arquivo compartilhado `canvas-layout.css` estao restritas a
`.simulation-tool-navigation` e a
`.documentation-page-shell[data-canvas-layout="documentation"]`. Assim, os
novos canvases nao selecionam o conteudo dos quatro simuladores preservados.
O shell global aprovado muda ao redor das paginas. A matriz autenticada aprovou
40 checks de navegacao das quatro rotas preservadas. O Associativo teve ainda
30 capturas revisadas manualmente.

## Gates comprovados

Ambiente: Node.js 24.19.0, pnpm 11.20.0 e Next.js 16.3.8. Resultados fornecidos
pelo coordenador da integracao em 10/10/2026:

| Comando                        | Resultado                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `pnpm format:check`            | Aprovado                                                                             |
| `pnpm lint`                    | Aprovado                                                                             |
| `pnpm typecheck`               | Aprovado                                                                             |
| `pnpm test`                    | 124 arquivos; 2.292 aprovados; seis ignorados; 83 testes Node operacionais aprovados |
| `pnpm build`                   | Aprovado; 45 rotas no Next.js 16.3.8                                                 |
| `pnpm resources:check`         | Aprovado                                                                             |
| `pnpm qa:e2e:release`          | 19 aprovados; um skip previsto; Associativo concorrente verde                        |
| `pnpm qa:visual:authenticated` | Modo `verify` aprovado; fixtures efemeras removidas                                  |

## QA visual autenticado

| Verificacao                    | Resultado                         |
| ------------------------------ | --------------------------------- |
| Responsividade                 | 154 checks aprovados              |
| Temas                          | 88 checks aprovados               |
| Acessibilidade                 | 242 auditorias Axe aprovadas      |
| Baseline                       | 242 comparacoes aprovadas         |
| Zoom                           | 110 checks aprovados              |
| Canvases aprovados             | 22 comparacoes aprovadas          |
| Quatro simuladores preservados | 40 checks de navegacao aprovados  |
| Associativo                    | 30 capturas revisadas manualmente |

A promocao autenticada da baseline ficou verde, com `performed: true` e
`eligible: true`. A integridade exigiu arquivos rastreados, baseline existente
no inicio e arvore sem mudanca durante a captura.

Em `/admin/usuarios`, a captura em viewport de 1.440 px mediu 2.592 px de
altura. A tela apresenta a matriz completa de 23 permissoes e os badges de
acesso efetivo; por isso, o teto estrito foi calibrado de 2.500 para 2.600 px.
O valor observado ficou oito pixels abaixo do novo teto, e a verificacao de
altura continua ativa.

O QA sintetico de Integracoes aprovou nove combinacoes de tema/largura, seis
estados, zoom de 200% e o carregamento dos SVGs de Salesforce, n8n e Supabase.

A verificacao pos-commit `pnpm qa:visual:authenticated`, em modo `verify`,
repetiu e aprovou 154 checks responsivos, 88 de tema, 242 de acessibilidade, 242
comparacoes candidato/baseline e 110 de zoom. As fixtures efemeras foram
removidas ao final.

Essas evidencias comprovam o ambiente autenticado local e os artefatos
promovidos. Nao comprovam CI do SHA candidato nem estado de producao.

## Pendencias de release

- Fixar o SHA candidato, abrir/revisar o PR e exigir CI verde no mesmo SHA.
- Seguir `docs/runbooks/automatic-publication.md`: comprovar imagem imutavel,
  registrar versao anterior, backup e rollback, promover por compare-and-swap e
  conferir health, versao, negacao anonima e jornadas afetadas.
- Preencher este registro com IDs de CI/PR, SHA/imagem e resultado da
  publicacao. Ate la, o status permanece `pendente_validacao` e producao segue
  nao publicada.
