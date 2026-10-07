# Contrato visual da consulta de repasse

Rota protegida: `/app/repasse`.

A referência enviada pelo usuário define a hierarquia da jornada: identificação
da consulta, entrada por FID e resultado com empreendimento, etapa, status, nome
do cliente e motivo. A aplicação preserva a navbar global do CRM e seus temas
Claro, Médio e Escuro; não reproduz um segundo cabeçalho global dentro da rota.

## Critérios

- A assessoria `M.A.P DE CAMPOS SOLUÇÕES` aparece antes da ação principal.
- O FID tem label visível, validação próxima ao campo, foco e estado de envio.
- Resultado, vazio, duplicidade e indisponibilidade não se confundem.
- A data da fonte aparece quando informada e ausência não vira data inventada.
- No desktop, o resultado usa tabela sem cortar conteúdo.
- No celular, as células refluem para blocos rotulados, sem rolagem horizontal.
- Status mantém texto visível; cor é somente reforço semântico.
- Os quatro viewports obrigatórios e os três temas são verificados no navegador.
- O navegador autenticado usa registros sintéticos disponíveis apenas quando
  aplicação, Supabase e flag de QA estão simultaneamente em loopback; nenhuma
  leitura da planilha real ou captura de dado de cliente integra essa matriz.
- A matriz fotografa o resultado sintético e também exerce vazio, duplicidade e
  indisponibilidade antes de concluir.
