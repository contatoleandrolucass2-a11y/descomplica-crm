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
  278 aprovados. CI Linux completa continua obrigatoria; gates nao reduzidos.

## Limites

Nao existe prova de todas as combinacoes infinitas de valores editaveis.
Testes numericos usam oraculos e dominios explicitamente delimitados.
Dados ausentes so podem ser corrigidos automaticamente mediante fonte oficial
inequivoca. A fonte oficial atual das unidades citadas foi solicitada ao usuario.
Nenhum teste extensivo ou carga sintetica e executado na VPS de producao.
