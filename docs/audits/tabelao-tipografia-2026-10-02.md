# Tabelao: tipografia e titulos completos

## Escopo

- Pedido de 02/10/2026, sete capturas fornecidas pelo usuario. Branch
  `codex/tabelao-tipografia-ptbr`, base `d7c06b6` publicada no PR #132.
- Fonte da tabela e titulos reduzida de 12 para 11px, conforme pedido.
- Todos os titulos em uma linha e caixa de frase, sem cortar letras.
  Incorporadora passa a Empresa somente no Tabelao, inclusive no filtro.
- Planta reduzida de 8,5% para 6,5% da tabela. Tipo e Terreo passam para duas
  linhas; a exibicao corrige a grafia para Terreo com acento. Regiao, metragem,
  vagas e estoque recebem os dois pontos percentuais liberados.
- Nomes proprios e siglas devem ser preservados, conforme confirmacao do usuario.
  Tabelao-presentation formata somente descricoes e plantas para exibicao;
  valores das opcoes, chaves comerciais, estoque e agrupamento nao mudam.
- Publico: corretor, imobiliaria e gestor comercial comparando unidades.
  Mantidos filtros, ordem regional, letras verticais, cabecalho ao rolar e
  Limitador visivel no desktop. Mobile mantem rolagem horizontal legivel.

## Criterios De Aceite

1. Medir 11px no corpo e cabecalho, sem regras mobile que voltem a 12px.
2. Regiao, Empresa, Metragem, Vagas e Estoque completos, sem quebra ou sobreposicao;
   conferir tambem os outros nove titulos, inclusive em 1100px de largura de tabela.
3. Conferir todas as colunas e Limitador dentro da tela a partir de 1280px.
4. Planta com quebra apos Tipo/Terreo, codigos como 2Q, PCD/PNE, HIS-2 e R2V
   intactos; ausencia continua distinta de zero e nomes proprios inalterados.
5. Filtros por empresa/planta/vagas/valor permanecem funcionais, com os mesmos
   valores e contagens. Comparacao por regiao, empreendimento e preco preservada.
6. Cabecalho continua acompanhando a rolagem abaixo da navegacao, sem duplicacao.

## Evidencias

- 42 testes unitarios do formatador e 17 contratos focados aprovados em Node
  24.19.0. Typecheck, build, lint do codigo e Prettier aprovados.
- Playwright local com o componente/CSS reais e dados sinteticos: nove cenarios
  entre 375 e 1920px, incluindo escala de 150%. Todos os titulos em uma linha,
  11px, textos integrais, filtros, nomes/siglas, regioes/vagas e cabecalho fixo
  aprovados. Capturas de 1280px e 390px inspecionadas. Harness sem autenticacao
  e com fontes locais; a matriz autenticada da CI continua obrigatoria.
- `pnpm lint` bruto encontrou 33 erros somente em artefatos locais ignorados de
  `test-results`; lint do codigo, excluindo esses artefatos, passou. A CI limpa
  deve executar o comando original sem exclusoes adicionais.
- `pnpm test`: 1383 aprovados, quatro skips existentes, seis falhas POSIX e cinco
  timeouts locais. Nova execucao integral com dois workers: 1388 aprovados,
  quatro skips e somente seis falhas POSIX de modos/symlinks. Nenhum teste foi
  desativado ou teve criterio relaxado. Oito testes Node tambem aprovados.
- Apos as regressoes da revisao: 1405 aprovados, quatro skips e as mesmas seis
  falhas POSIX. Build, tipos, lint do codigo e nove cenarios Playwright repetidos
  e aprovados com os dois casos corrigidos.
- CI Linux completa, referencias autenticadas e publicacao pendentes. Sem
  consulta ao banco, migration, n8n ou dependencia nova.
- Revisao independente identificou dois casos corrigidos antes da publicacao:
  nomes/siglas ligados por hifen e rotulos distintos com C/AP ou C/ AP. O
  formatador agora limita a caixa de frase ao vocabulario comum conhecido,
  preservando palavras desconhecidas e espacos junto a barra. A fixture real
  passou de seis para sete opcoes e verifica ambas as selecoes separadamente.

## Reversao

Alteracao somente de apresentacao. Seguir a publicacao autorizada com PR/CI,
imagem imutavel, backup, CAS e rollback da imagem, sem operacoes em dados remotos.
