# Associativo: Origem E Brilho

## Escopo

Branch `codex/associativo-origem-e-brilho-integral`, base `3e0f5d1`.
Correcao da jornada com dados ausentes e dos efeitos visuais solicitados.
Ranking externo consultado somente por GET como referencia visual.
Sem mudanca nas fontes, regras comerciais, migrations, permissoes ou n8n.

## Diagnostico Confirmado

Leitura observacional em 04/10/2026 do snapshot montado no runtime e da API
de origem. Somente agregados foram registrados; nenhum estoque bruto foi
exportado ou adicionado ao repositorio.

| Fonte                  | Registros | Observacao                                                |
| ---------------------- | --------: | --------------------------------------------------------- |
| Snapshot de 05/09/2026 |      3301 | 3179 elegiveis para exibicao; 2865 selecionaveis          |
| API de origem          |      2243 | `generatedAt` de 07/08/2026; fonte distinta e mais antiga |

No snapshot, 84 unidades visiveis estao sem andamento da obra, 594 sem
avaliacao positiva e 84 sem ambos. Entre as selecionaveis, 280 estao sem
avaliacao positiva. As duas unidades citadas no pedido ja possuem ambos
os campos nulos no arquivo e nao aparecem na API alternativa.

A validacao anterior comprovou unidades com dados completos e cenarios
sinteticos; nao comprovou completude de todas as unidades do snapshot.
Ausencia genuina nao deve virar zero, preco de venda ou dado da unidade vizinha.

## Tratamento

- Dados ausentes ficam explicitos logo apos a unidade selecionada.
- Percentual oficial pode ser informado de 0 a 100%, somente na simulacao.
  Vazio, negativos, nao finitos e valores acima de 100% nao liberam o calculo.
- Dado valido do estoque conserva autoridade. Campos manuais especificos
  sao limpos ao trocar unidade; renda e composicao financeira continuam.
- Avaliacao manual existente continua alimentando documentacao e proposta;
  a fonte permanece identificada como incompleta e nao e alterada.
- Comprometimento e cronograma nao sao bloqueados por falta de andamento.
  Maximo mensal e aprovacao dependem do percentual oficial.
- Documentacao depende da avaliacao; sua ausencia nao zera o fluxo mensal.
- Resposta viva tardia completa somente fatos nulos com identidade unica nas
  duas colecoes e entrega igual, sem trocar preco, ID, entrega ou recursos.
  A comparacao observacional encontrou 54 avaliacoes compativeis. Quatro
  andamentos potencialmente correspondentes foram recusados por entrega
  divergente. Nao altera outras paginas nem torna a API antiga uma fonte atual.
- Datas inexistentes, como 29/02/2027 e 31/04/2027, sao rejeitadas nos motores
  Linear e Decrescente em vez de normalizadas silenciosamente pelo JavaScript.

## Interface

- Brilho integral com nucleo branco a 70% e ombros dourados, ciclo de 3s.
  Gradiente da selecao vai do dourado para a superficie normal, sem reiniciar
  a cada celula; somente escolhas selecionadas mantem o brilho automatico.
- Reflexo de hover/foco em botoes, links de acao, rodape e dialogos do
  Associativo, sem alterar o cabecalho compartilhado ou paginas de referencia.
- Icone dolar alinhado a ultima data no espaco entre tabela e painel; alvo de
  24px com mouse e 44px com toque, icone de 17px, sem sobrepor texto.
- Movimento reduzido remove animacoes. Halo opaco de 1px protege a leitura
  no tema escuro durante a passagem do brilho.
- Preview usa captura da viewport: screenshot de elemento maior que a tela
  removia a emulacao de toque no Chromium. O teste agora verifica ponteiro
  antes/depois e detectou um deslocamento legado de 3px no rodape, corrigido.

## Validacao

- Matriz v2: 14.014 casos e 3.392.640 comparacoes contabilizadas, zero erros
  reais/divergencias. Sao 7.285 casos sinteticos delimitados mais tres perfis
  para cada um dos 2.243 registros da API publica. Os seis rankings sao
  percorridos na grade sintetica; os perfis de estoque usam Ouro, Prata e Bronze.
- Estoque da API: 6.729 casos, 6.459 calculaveis e 270 bloqueios justificados.
  Reprovacao comercial esperada e resultado calculavel, nao erro aritmetico.
  A matriz nao atesta atualidade da politica nem aprovacao bancaria.
- Entradas consumidas identicas reutilizam verificacao somente durante a mesma
  execucao; cada registro/perfil segue contado. Testes comprovam equivalencia
  e distinguem nulo, ausente, nao finitos e alteracoes de cada entrada.
- Regressao com valores do print: comprometimento Linear 12,92% e Decrescente
  17,78%; maximo pendente sem andamento. Percentuais oficiais 0/15/100 recalculam.
- 85 testes da revisao independente de fatos/estado, 41 de efeitos/temas/guia
  com Chromium, 222 da matriz e 95 de politicas/adaptador/golden/datas aprovados.
- Continuidade v3: oito etapas em 375 e 1440px nos tres temas, incluindo
  recuperacao de fatos, isolamento entre unidades e resposta viva tardia sem
  substituir a proposta. Nova execucao final preserva o ponteiro de toque.
- Seis jornadas de guia v7 aprovadas nos tres temas e duas larguras, com toque
  preservado, alvo 44px no celular e 24px no desktop, sem sobreposicao.
- Build final, lint, tipos, formatacao, audit e oito testes Node Salesforce
  aprovados. Suite Windows: 1.888 aprovados, dois skips existentes, seis falhas
  POSIX e tres timeouts. Repeticao isolada dos arquivos com timeout e matriz:
  278 aprovados. CI Linux completa aprovada, conforme evidencia abaixo;
  gates nao reduzidos.

## CI E Publicacao

- PR [#147](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/147)
  aprovado pela CI `37220843131` e integrado em
  `f4dec82249c2b3e56beaaea518ec194ced81b480`.
- CI do main `37222464725`: validacao Linux, banco, restore isolado,
  release gates e imagem promovivel aprovados. QA: 147 verificacoes responsivas,
  84 de temas, 201 Axe, 201 capturas/comparacoes e 105 de zoom, alem de 40
  combinacoes de navegacao arquivada. Nenhuma baseline foi promovida.
- Artefato visual do main `11311686197`, ZIP SHA-256
  `f51fcb420a37b1492171b379cba76921121cf30a42a0ff53256a1df295ab6546`.
- Artefato de imagem `11310807042`, ZIP SHA-256
  `d9a6fcda2c03670983042dfe99ab3bd80d8a522979963ef2c2938f69c17d45bc`.
  `image.tar.gz` SHA-256:
  `15db42c7ad9777826d84e8ea09a49bdfdc1f2112036974b2f50503c88e40c3ce`.
- Config digest da imagem:
  `sha256:5274f7bb9a7e37085619c425bee5603fa1b8211767d2bdaf882dcb1763275f14`.
  ID/manifest OCI carregado no containerd:
  `sha256:b8e9d14c02519911cecc70c23236a2fae558f7d0f73e3ef6bd57894c39152df1`.
  Arquivo, config, label, plataforma e 11 camadas conferidos antes da promocao.
- Publicacao com lock e compare-and-swap a partir de
  `106d626850a6cc782ec198387074be9e8901dd78`, checkout destacado limpo em
  `/srv/descomplica-crm-releases/f4dec82249c2b3e56beaaea518ec194ced81b480`.
  O checkout principal remoto nao foi restaurado nem sobrescrito.
- Backup verificado:
  `/var/backups/descomplica-crm/releases/f4dec82249c2b3e56beaaea518ec194ced81b480.3p39VA`.
  Diretorio root:root 0700 e manifesto 0600, hashes conferidos; imagem anterior
  preservada para rollback. Configuracao Nginx sem alteracao.
- O transporte SSH desconectou apos a mensagem de promocao concluida. Sem
  repetir deploy, verificacoes independentes confirmaram container healthy,
  imagem exata e health HTTP 200 com a nova versao. Smoke limitado: 12 GETs,
  concorrencia quatro, zero erros; inventarios anonimos 401 e no-store.
  Isso nao e benchmark nem prova de capacidade.
- Conferencia autenticada limitada em 04/10/2026: renda, financiamento e entrada
  sinteticos preservados ao trocar duas unidades disponiveis. Comprometimentos
  14,13%/17,58% e maximos 44,13%/44,71% calculados; Ouro aprovado nos dois fluxos.
  Gradiente publicado confirmado e controles de rodape com camada especular.
  Nenhuma proposta foi salva, enviada ou usada para decisao de cliente.
- Essa conferencia carregou 2.135 unidades visiveis da API de 07/08/2026;
  nao representa completude do snapshot de 05/09 nem verifica novamente as
  duas unidades ausentes dessa API. A pendencia da fonte oficial permanece.
- Fechamento documental publicado separadamente no Git, sem nova promocao
  da aplicacao: runtime permanece no SHA `f4dec82249c2b3e56beaaea518ec194ced81b480`.

## Limites

Nao existe prova de todas as combinacoes infinitas de valores editaveis.
Testes numericos usam oraculos e dominios explicitamente delimitados.
Dados ausentes so podem ser corrigidos automaticamente mediante fonte oficial
inequivoca. A fonte oficial atual das unidades citadas foi solicitada ao usuario.
Nenhum teste extensivo ou carga sintetica e executado na VPS de producao.
