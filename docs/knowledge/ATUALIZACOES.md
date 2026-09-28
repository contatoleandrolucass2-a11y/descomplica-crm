# Aprendizados e atualizacoes

Registrar uma entrada curta por resultado tecnico relevante. Usar data real,
fonte, status (rascunho, pendente_validacao, validado ou arquivado), evidencias
e pendencias. Nunca copiar chats completos, segredos, clientes ou estoque bruto.

## 2026-09-27: desempenho do estoque

- Status: validado.
- Fonte: PRs #94 e #95; docs/runbooks/inventory-performance.md;
  CI 36349004691; conferencias de producao neste chat.
- Fontes de estoque em paralelo, cache de 30 segundos com autorizacao antes do
  cache, deduplicacao e reducao de calculos repetidos dos filtros.
- Benchmark de facetas por regiao: mediana de 57,023 ms para 12,449 ms em 3.301
  unidades. Nao representa reducao equivalente no tempo total de abertura.
- Regra compacta herdada com !important impediu inicialmente o alvo de 44 px.
  Corrigida a prioridade CSS e acrescentada medicao geometrica no teste visual.
- Validacao: lint, tipos, testes, build e matriz visual aprovados na CI Linux.
  Conferencia real confirmou filtros utilizaveis, botao de 44 px e console limpo.
- Limite operacional: a VPS sofreu pressao de memoria com testes visuais
  extensivos. Preferir a CI para a matriz pesada; nao interromper servicos alheios.
- Nao houve alteracao de regras financeiras, schema ou workflows n8n.

## 2026-09-27: memoria local e ferramentas automaticas

- Status: validado (instalacao e testes locais especificos).
- Fonte: scripts/knowledge/obsidian.mjs e docs/runbooks/obsidian-project-memory.md.
- Documentos tecnicos selecionados sao exportados para o vault local. Cada
  checkout tem estado separado; historico deduplicado por conteudo e revisao.
- Hooks Git locais sincronizam commits, merges, checkouts e rewrites. AGENTS.md
  define consulta inicial, roteamento automatico de skills e registro final.
- Notas editadas manualmente, links simbolicos e possiveis credenciais bloqueiam
  a exportacao. Nenhum plugin comunitario, SDK ou servico pago e necessario.
- Validacao: 14 testes especificos aprovados, incluindo hook post-commit real,
  worktrees, concorrencia, idempotencia e preservacao de notas manuais.
- Instalacao conferida nos tres checkouts locais; o CLI do Obsidian leu o indice
  gerado. Backup anterior com 77 arquivos e restauracao por hash aprovada.
- Lint, tipos e build das 41 rotas passaram no Windows. A suite geral encontrou
  as seis falhas preexistentes ligadas a permissoes POSIX; consultar a CI Linux
  do PR para a validacao integral antes do merge.
- Nenhuma alteracao de producao, conta, plugin comunitario ou regra financeira.
