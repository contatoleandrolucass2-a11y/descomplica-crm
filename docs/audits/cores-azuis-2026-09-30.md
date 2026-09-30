# Correcao das cores dos simuladores

Data: 2026-09-30. Branch: codex/temas-azul-original.
Status: implementado e capturas revisadas; CI integrada e publicacao pendentes.

## Escopo

Pedido direto: preservar o fundo original do modo escuro e trocar verde por
azul nos temas Claro, Medio e Escuro. A identidade anterior introduziu tons
esverdeados sem que essa mudanca tivesse sido solicitada.

- Restaura pagina #061f35, painel #0a2b47, painel forte #0c3655 e cabecalho
  #071a31. Fonte: investor-archive.css anterior a identidade, commit 96410f9.
- Troca destaques, estados positivos, marca e superficies esverdeadas por azul.
- Preserva avisos e erros distinguiveis, rotulos e estados acessiveis.
- Escopo: cabecalho e tokens compartilhados de Associativo, Direta, Investidor
  e Tabelao. Nao altera outras paginas, geometria, formulas, estoque ou acesso.
- Tokens legados lime/cyan e positivos sao limitados ao shell dos simuladores;
  nao modificar a paleta global de outras areas para corrigir esta demanda.

## Validacao

Testes de regressao protegem o azul-marinho original, os destaques azuis nos
tres temas e contraste textual minimo de 4.5:1 entre tokens. A medicao de
tokens nao substitui axe e verificacao visual sobre o resultado renderizado.

- Lint, typecheck e build aprovados no Windows. Suite completa: 992 testes
  aprovados, um skip, seis falhas POSIX conhecidas e dois timeouts DevTools.
  Reteste isolado: 37 testes de DevTools/cores/navegacao aprovados; oito testes
  Node aprovados. Nao foram alterados timeouts, assercoes ou permissoes.
- Preview sintetico: 40/40 combinacoes de quatro rotas e dez larguras, nos
  tres temas, sem erro de navegador. Fonte: blue-themes-preview.json local.
- CUA confirmou Claro, Medio e Escuro; Associativo sintetico com unidade e
  perfil selecionados: 1.134 elementos visiveis sem verde detectado nas cores
  RGB de texto, fundos, bordas, sombras e pseudo-elementos. Essa amostra nao
  certifica todas as rotas e estados; a matriz autenticada permanece obrigatoria.
- CI 36726351781: validate, banco, advisors, restore e E2E aprovados.
  Matriz: 40 navegacoes, 193 auditorias axe e 100 cenarios de zoom aprovados.
  Unica divergencia: 44 comparacoes visuais dos quatro simuladores.
- Inspeciona as 44 capturas do merge 7378a976af29f4ac7fa8c0de89f46c685493d32e
  em onze grupos de viewport/tema. Azul-marinho restaurado, azul nos destaques,
  sem novas colisoes ou mudancas de geometria identificadas.
- Promocao pelo contrato canonico: verifica gates funcionais, proveniencia,
  hashes, checkout limpo na captura e baseline inalterada. Promove 44 imagens,
  preserva as outras 149 e os limites de 1%/16 por canal.

Pendente: nova CI integrada das referencias e publicacao pelo artefato imutavel
do SHA final, com backup, CAS e verificacao pos-publicacao.
