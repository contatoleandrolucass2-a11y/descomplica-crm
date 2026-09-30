# Correcao das cores dos simuladores

Data: 2026-09-30. Branch: codex/temas-azul-original.
Status: validado e publicado na release b55fa6fc95eb26087c70736d618bf019818c5876.

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
- CI 36730344413 parou na formatacao do manifesto gerado. Normaliza com
  Prettier apos a promocao, sem alterar conteudo semantico, imagens ou gates.

## Publicacao

- PR #112 integrado apos CI 36730636073 aprovada. CI main 36734239866
  inteiramente aprovada no SHA b55fa6fc95eb26087c70736d618bf019818c5876.
- Imagem da CI carregada sem rebuild, checksum, configuracao, manifesto e onze
  camadas verificados. Digest local:
  sha256:fa82d6a5b01dff6edaaca3dbdcb2e0634070d2c350a9484422f7ed77c1746f80.
  Dois perfis de runtime aprovados no destino.
- Backup privado, CAS da release 2c002df10fa2777165fec5b96f707ed971422e74 e
  rollback preparado. Nginx preservado; nenhuma alteracao de banco ou contas.
- Health local e publico confirmam a nova release. Doze GETs anonimos, quatro
  concorrentes, zero falhas; estoque/snapshot continuam 401 e no-store.
  Esse smoke nao e benchmark de capacidade.
- Navegador autenticado confirma Claro #f3f6fa/#0754a6, Medio #d9e1eb/#084b92
  e Escuro #061f35/#7dd3fc (pagina/destaque). Estoque carregado, zero erros de
  console observados e modo Escuro restabelecido ao encerrar a verificacao.
- Registro final apenas documental: nao reiniciar a aplicacao por este commit.
