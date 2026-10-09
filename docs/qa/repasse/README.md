# Contrato visual da gestão de repasses

Rota protegida para Master e Admin: `/app/repasse`.

A visão geral organiza clientes em quatro colunas operacionais: Repassado,
Pendência, Mais de 20 dias e Distrato / desistência. A consulta individual por
FID permanece em uma segunda aba. A aplicação preserva a navbar global do CRM e
seus temas Claro, Médio e Escuro; não reproduz um segundo cabeçalho global
dentro da rota.

## Critérios

- A assessoria `M.A.P DE CAMPOS SOLUÇÕES` e a data da fonte aparecem no cabeçalho;
  ausência da data não vira data inventada.
- As abas Visão geral e Consulta por FID funcionam por clique e teclado.
- Busca por cliente ou FID, empreendimento e status filtram os cartões sem
  alterar os totais da origem.
- Cada cartão mantém cliente, FID, empreendimento, etapa e status em texto. Cor
  é somente reforço semântico.
- Verde significa repassado; amarelo, pendência; vermelho, distrato ou
  desistência; laranja exige duração superior a 20 dias escrita na fonte.
- O detalhe abre em diálogo nomeado, carrega motivo somente pelo FID exato,
  fecha por botão e `Escape` e devolve o foco ao cartão acionador.
- O FID tem label visível, validação próxima ao campo, foco e estado de envio.
- Resultado, vazio, duplicidade e indisponibilidade da consulta individual não
  se confundem.
- Desktop e celular preservam todo o conteúdo sem rolagem horizontal global.
- Os quatro viewports obrigatórios e os três temas são verificados no navegador.
- A matriz fotografa a visão geral em 375x812, 768x1024, 1024x768 e 1440x900,
  nos três temas, e executa Axe e detecção de overflow em cada combinação.
- O navegador autenticado recebe oito cartões sintéticos, dois por coluna,
  somente quando aplicação, Supabase e flag de QA estão simultaneamente em
  loopback. Nenhuma leitura da planilha real ou captura de dado de cliente
  integra a matriz.
- Além dos filtros e do detalhe, a matriz exerce resultado, vazio, duplicidade,
  indisponibilidade, validação nativa e ordem de foco da consulta por FID.
