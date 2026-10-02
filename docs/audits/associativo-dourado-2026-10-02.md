# Associativo: azul noturno e dourado metalico

## Escopo

- Fonte: pedido e captura do usuario de 02/10/2026, posteriores a entrega prata.
- Branch: codex/associativo-azul-noturno-dourado; base d7c06b6.
- Fundo escuro #040d19, painel #091a2c, campos #050f1d e bordas #526b84.
- Dourado #e9bd54 com gradiente metalico e texto #2e230c nas selecoes,
  perfil atual, campo financeiro pendente, orientacao e seletor de ranking.
- Preserva layout, marca, claro/medio, sequencia renda/modalidade/primeiro imovel,
  brilho recorrente de tres segundos e preferencia de movimento reduzido.
- Nenhuma alteracao em regras financeiras, dados, n8n ou outras tabelas.

## Verificacao

- 28 testes focados aprovados: cores/contraste, geometria e sequencia.
- Navegador local sintetico: 6/6 em 1440x900 e 375x812 nos tres temas,
  sequencia completa, contraste >=4.5:1, brilho/repouso e geometria preservados.
- Fundo/painel renderizados conferidos em RGB(4,13,25)/RGB(9,26,44), estoque
  inicial sem rolagem global no desktop testado; hover/foco dourados aprovados.
- Lint, typecheck e build aprovados. Windows: 1366 testes aprovados, um skip,
  seis falhas de permissao POSIX/symlink; sem skips ou enfraquecimento de gates.
- CI Linux, referencias visuais autenticadas e publicacao: pendentes.
- Gate visual deve revisar somente diferencas do Associativo, preservando
  referencias de outras rotas e tolerancias existentes.

## Publicacao

Pendente. Exigir CI integral, imagem imutavel, backup, compare-and-swap,
rollback e verificacoes observacionais de saude/versao e acesso anonimo.
