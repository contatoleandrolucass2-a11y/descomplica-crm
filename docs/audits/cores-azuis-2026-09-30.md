# Correcao das cores dos simuladores

Data: 2026-09-30. Branch: codex/temas-azul-original.
Status: implementado; validacao e publicacao pendentes.

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

Pendente: comandos obrigatorios, navegador local, CI Linux, revisao das
referencias visuais afetadas e publicacao pelo artefato imutavel validado.
