# Tabelao: layout e links de endereco

## Escopo

Pedido de 02/10/2026 com sete capturas. Destino explicitamente confirmado:
`/app/simulacao/tabelao`. Base `3960724`, branch `codex/tabelao-layout-maps`.
Preservar tipografia de 11px, paleta, filtros, agrupamento, formulas e demais
simuladores. A pagina publica de documentacao nao pertence a esta alteracao.

## Criterios de aceite

1. Cabecalho compacto como o Associativo, apenas Simulador Tabelao e icone de
   informacao alinhado; guia funcional e sem breadcrumb/eyebrow redundantes.
2. Apos Estoque: % obra, Limitador, Volta ao Caixa, Avaliacao, Valor do Imovel.
   Cabecalho, colgroup e corpo alinhados inclusive em linhas com rowspan.
3. Valor do Imovel dourado e destacado nos tres temas, preservando contraste.
4. Endereco da origem oficial atual, confirmada pelo usuario, com URL Google
   Maps montada a partir dos componentes presentes. Sem logradouro, sem link.
5. Recursos finais nesta ordem e com icones: Aprenda +, Politica comercial,
   Imprimir, Bora Vender e Salesforce. Aprenda + abre o guia existente.
6. Impressao mostra a tabela e suas linhas; controles interativos nao aparecem.
7. Teclado, foco, celular, tablet, desktop, temas e ausencia de dados preservados.

## Limites de dados

- `/api/inventory` autoriza cada requisicao e consulta o endpoint oficial externo.
- `/api/inventory/snapshot` oferece a referencia protegida do ESTOQUE SPC.
- Nenhuma nova consulta SQL, migration, escrita remota, refresh ou regra comercial.
- Links externos conhecidos do projeto mantidos. O Maps so recebe o endereco
  quando o usuario aciona o link, sem geocodificacao automatica adicional.
- Sintaxe conferida na [documentacao oficial Maps URLs](https://developers.google.com/maps/documentation/urls/get-started).
- Enriquecimento recusa conflitos conhecidos de cidade, UF ou CEP; ausencias
  nao criam divergencias ficticias e multiplos contextos ambiguos nao sao unidos.
- Destino de Politica comercial solicitado ao usuario, ainda nao informado.
  Controle permanece visivel e desabilitado; nao reutiliza politica de outro motor.

## Verificacao

- Windows, Node 24.19.0, pnpm 11.20.0.
- Lint, typecheck e build iniciais aprovados.
- Duas suites integrais interrompidas sob baixa memoria, incluindo repeticao com
  dois workers, apos seis falhas POSIX conhecidas e timeouts locais. Nenhum
  teste/limiar foi reduzido para obter verde. CI Linux permanece obrigatoria.
- Dados/apresentacao: 283 testes aprovados; um timeout do snapshot passou na
  repeticao isolada com um worker. Contratos de interface: 18/18 aprovados, com
  8/8 do Tabelao repetidos pelo coordenador. Oito testes Node aprovados.
- Preview local com componentes/CSS reais e dados sinteticos: cabecalho, ordem,
  enderecos Maps e recursos vistos no navegador. Header do preview e uma fixture,
  portanto nao substitui autenticacao e matriz completa da CI.
- Provas funcionais de layout passaram em seis larguras, de 320 a 1440px,
  incluindo impressao e quatro criterios de Maps. Dourado/negrito passam em
  seis larguras por tres temas. Runner completo registrou tres assets 404 do
  preview, portanto nao foi declarado integralmente aprovado.
- CI, referencias visuais revisadas, imagem, publicacao e smoke final pendentes.

## Reversao

Seguir automatic-publication.md e o runbook de imagem promovivel. Reverter por
imagem anterior com CAS; nao alterar estoque ou demais dados para reverter layout.
