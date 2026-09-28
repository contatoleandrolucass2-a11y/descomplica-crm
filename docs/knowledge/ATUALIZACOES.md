# Aprendizados e atualizacoes

Registrar uma entrada curta por resultado tecnico relevante. Usar data real,
fonte, status (rascunho, pendente_validacao, validado ou arquivado), evidencias
e pendencias. Nunca copiar chats completos, segredos, clientes ou estoque bruto.

## 2026-09-28: Caveman automatico e regressao do estoque

- Status: validado (local; gates Linux vinculados ao PR, sem publicacao).
- Fonte: docs/audits/caveman-ferramentas-2026-09-28.md; FERRAMENTAS.md;
  InvestorCalculator.tsx; rota inventory/snapshot; testes e QA sintetico.
- Caveman Lite rege concisao, nao exatidao financeira; Cavecrew complementa os
  sete agentes crm-\* existentes. Onze skills locais constam no inventario.
- Next DevTools/Chrome DevTools sao diagnosticos locais, sem contas novas,
  telemetria, CrUX ou conexao a navegador pessoal. MCP configurado nao implica
  ferramenta carregada no chat atual; conferir em nova sessao e usar runbook.
- Filtrar nao inicia proposta: somente selecao da unidade bloqueia substituicao
  pela fonte viva. Filtrar/limpar deve preservar unidade e valores preenchidos.
- Snapshot frio precisa compartilhar leitura em andamento e limpar falhas para
  retry, sempre apos autorizacao individual; no-store e integridade preservados.
- Vitest 4.1.11 aprovado no PR #65 e integrado; nao migrar major sem necessidade.
- Testes Windows: 806 aprovados, seis falhas POSIX preexistentes e um skip;
  oito testes Salesforce passaram separadamente. Lint/tipos, inventario, MCPs,
  Gitleaks, pnpm audit e OSV passaram; scanners sem achados conhecidos apos
  corrigir o SDK transitivo do Next MCP para 1.30.1. Sem ignores de seguranca.
- Pendencias: gates finais desta branch, fontes/politicas de negocio e eventual
  publicacao explicitamente autorizada. Nenhum ganho percentual foi medido.

## 2026-09-28: prontidao e selecao das ferramentas

- Status: validado (instalacoes e verificacoes locais; gates Linux vinculados ao PR).
- Fonte: scripts/knowledge/doctor.mjs; tests/project-resource-doctor.test.ts;
  catalogo de plugins; releases oficiais Gitleaks v8.30.1 e OSV-Scanner v2.6.0.
- Codex Security agora consta instalado/habilitado, atualizando a observacao
  historica anterior. Selecionar skill por alvo, cumprir preflight e preservar
  aprovacoes; nao acionar scans completos em tarefas sem demanda de seguranca.
- Gitleaks/OSV instalados em ~/.local/bin no Windows, com hashes verificados.
  secrets passou; OSV encontrou somente o advisory moderado GHSA-82fw-gwwq-j7x9
  em Vitest/@vitest/mocker 4.1.10, rastreado no PR #65; achado nao foi suprimido.
- resources:doctor distingue disponibilidade local de autenticacao e testes.
  Docker nao instalado neste desktop; gates isolados continuam na CI Linux.
- Doctor real, 16 testes novos, 26 de conhecimento/inventario, lint, tipos,
  build e formatacao passaram. Suite geral Windows tem seis falhas POSIX
  preexistentes; um timeout inicial nao repetiu com dois workers. Oito testes
  Node Salesforce passaram separadamente; CI Linux valida o candidato integral.
- Revisao independente corrigiu falsos positivos de Supabase sem binario e
  scanner antigo. O diagnostico exige CLI Supabase na versao do pacote e
  Gitleaks 8.19+ serie 8 / OSV serie 2; novos majors precisam ser validados.
- Perfil crm-qa aplicado em delegacao real e inventario validado: 40 arquivos,
  nove areas, sete perfis e quatro skills. Nao foram executados todos os perfis.
- Pendencias: conferir conexoes quando forem usadas; MCP n8n nao exposto nesta
  sessao, sem alteracao de workflow nem fallback REST. PostHog/Datadog opcionais
  nao equivalem a telemetria do CRM configurada. Sem SDK, conta nova ou deploy.

## 2026-09-28: recursos e busca entre chats

- Status: validado (mecanismo e instalacao local; gates Linux vinculados ao PR).
- Fonte: PR #99 (recursos-memoria-crm); docs/audits/recursos-crm-2026-09-28.md; scripts/knowledge;
  tests/obsidian-knowledge.test.ts; tests/project-resources.test.ts.
- Conhecimento compartilhado e documental: agentes registram aprendizados,
  nao conversas completas. knowledge:search recupera trechos do checkout e
  aprendizados de outros worktrees sincronizados; nao treina o modelo.
- Sete agentes locais e quatro skills de dominio. Novas sessoes carregam os
  arquivos; nao ha injecao retroativa em chats nem autorizacao adicional.
- Manifesto cobre 40 arquivos de rotas/APIs em nove areas, com teste que detecta
  rotas novas sem mapeamento. Nao certifica todos os slugs ou papeis dinamicos.
- Navegador em 27/09: 19 rotas inspecionadas em leitura com Master. Dashboard
  sem overflow global nas quatro larguras, mas metas ainda sem fonte segura;
  ranking bloqueado por politica e parcerias aguardando conciliacao. Confirmar
  estado atual antes de agir; nao remover bloqueios por suposicao.
- Catalogo confirmou plugins principais instalados; autenticacao e telemetria
  sao verificacoes separadas. Codex Security apenas sugerido, nao confirmado.
- Validacao: 26 testes especificos, lint, tipos, build e formatacao passam.
  Suite geral Windows: 744 passam, seis falhas POSIX conhecidas e um skip;
  oito testes Node Salesforce passam em execucao separada. CI Linux e o gate
  integral, nao suprimir as falhas locais para obter resultado verde.
- Revisao independente corrigiu isolamento entre repositorios, proveniencia de
  fallback, geracoes intercaladas e tamanho dos titulos; regressao automatizada.
- Instalacao compartilhada atualizada e conferida nos tres checkouts, inclusive
  busca a partir da branch antiga e leitura pelo CLI do Obsidian. Backup de
  100 arquivos restaurado com hashes equivalentes em 28/09/2026.
- Audit: dois moderados em Vitest/@vitest/mocker, sem altos/criticos. Atualizacao
  ja proposta no PR Dependabot #65; nao foi misturada a esta entrega.
- Diagnostico CLI: configuracao carregada, mas verificacao opcional do MCP n8n
  sofreu timeout. Revalidar o conector quando necessario; nenhuma alteracao de
  workflow ou credenciais foi tentada e nao existe fallback REST autorizado.
- Nenhuma publicacao em producao ou alteracao de dados remotos.

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
