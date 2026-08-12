# Plano de migração

## Gate 0 — preparação obrigatória

- [x] Preservar e identificar os dois ZIPs e históricos Git.
- [x] Inventariar dependências, imports, integrações e scripts.
- [x] Higienizar segredo encontrado sem expor seu valor.
- [x] Preparar Node, pnpm, Docker, Supabase CLI, PostgreSQL client e scanners.
- [x] Executar o baseline de ambos os projetos e registrar falhas preexistentes.
- [x] Fixar arquitetura e dependências da base final.
- [x] Fazer lint, typecheck, testes, auditoria e build da base final.
- [x] Criar checkpoint Git local da preparação.
- [x] Criar repositório GitHub e enviar a branch de preparação.

Gate 0 encerrado em 2026-08-04 após CI remota verde na PR draft #1. As próximas etapas devem usar branch própria e manter os gates de qualidade.

## Gate 1 — estrutura e permissões

- [x] Catalogar todas as rotas, páginas, APIs e componentes do CRM.
- [x] Definir catálogo dinâmico de páginas e matriz de permissões.
- [x] Implementar painel administrativo inicial de usuários, papéis e permissões com auditoria.
- [x] Criar testes de autorização por papel, status e override.

Gate 1 implementado na branch `feat/gate1-page-catalog`; o encerramento depende dos gates locais e da CI do pull request.

## Gate 2 — banco e APIs

- [x] Mapear o read model do dashboard D1/JSON para PostgreSQL normalizado.
- [x] Criar migration, grants, RLS e testes do dashboard somente leitura.
- [x] Migrar a interface inicial do dashboard sem dados demo ou usuário fixo.
- [x] Migrar metas dos funis DV e parcerias com escrita auditada.
- [x] Migrar configuração de pontos com escrita auditada.
- [x] Migrar ranking com read model normalizado e pontuação dinâmica.
- [x] Migrar detalhes das cinco etapas sobre o read model do dashboard.
- [x] Substituir APIs manuais por Route Handlers/Server Actions autenticados.
- [x] Migrar ingestão e Salesforce com segredos server-side e controles de abuso.

## Gate 3 — interface

- [x] Migrar shell protegido, navegação ativa e temas claro/equilibrado/escuro.
- [x] Migrar páginas por domínio, preservando responsividade.
- [x] Remover dados demo e usuário hard-coded.
- [x] Integrar navegação e ações à matriz de permissões.
- [ ] Migrar filtros dimensionais após criar o read model normalizado de registros.

### Fundação de paridade com a referência viva

- [x] Inventariar as 18 páginas da referência viva.
- [x] Versionar matriz de paridade e catálogo de páginas, componentes e fontes.
- [x] Criar baseline visual sanitizada sem PII ou dados comerciais legíveis.
- [x] Implementar topbar e navegação hierárquica autorizada.
- [x] Implementar cards, filtros, roscas, funis, gauges, tabelas, rankings,
      skeletons e estados analíticos reutilizáveis.
- [x] Restaurar visualmente dashboard e cinco páginas de etapas usando o read
      model existente.
- [x] Restaurar a composição visual de ranking, Canal de Parcerias,
      configurações, metas do funil, metas de parcerias e metas de pontos sem
      alterar seus contratos seguros.
- [x] Criar hub e cinco jornadas visuais de simulação, protegidos por catálogo,
      permissão e guard; manter todos os motores bloqueados.
- [x] Executar QA autenticado complementar com conta dedicada e fixtures
      sintéticas no Supabase local; produção não foi usada nem alterada.
- [ ] Executar comparação autenticada em homologação com conta QA dedicada.
      Bloqueio: ambiente e credenciais QA de homologação continuam ausentes;
      a evidência local não substitui este gate.
- [ ] Conectar fontes pendentes do Canal de Parcerias e motores WF13, WF14,
      WF15, WF16 e CAIXA somente em incrementos próprios com regra oficial.
- [ ] Tratar ranking avançado, roleta, prêmios e novos cálculos comerciais
      somente nos incrementos separados já aprovados.

### Runtime de políticas comerciais

- [x] Catalogar 14 motores sem semear regra ou valor comercial.
- [x] Implementar DSL determinística, decimal exato, datas, versões imutáveis e
      casos de ouro obrigatórios.
- [x] Criar preview/apply, owners/backup, gates e ledger hashes-only com
      `FORCE RLS` e grants mínimos.
- [x] Isolar lookup/auditoria em schema e papel PostgreSQL dedicados, `NOLOGIN`
      e fora da Data API, com provisionamento privado ainda bloqueado.
- [x] Criar endpoint autenticado somente para os cinco simuladores, ainda sem
      conectar os formulários visuais.
- [x] Manter modo `off`, allowlist vazia, zero grant de execução e zero policy/
      gate seedado.
- [ ] Receber e aprovar políticas/casos de ouro oficiais por domínio.
- [ ] Integrar cada consumidor e fonte com autorização/RLS próprias.
- [ ] Executar shadow, canário e cutover somente após autorização explícita.
- [ ] Provisionar credencial privada do papel dedicado e corrigir ACLs herdadas
      somente no incremento remoto autorizado, comprovando o helper de isolamento.

## Gate 4 — entrega

1. Testes unitários, integração, E2E, acessibilidade e responsividade.
2. CI GitHub e proteção de branch.
3. Backup e preparação da VPS Hostinger.
4. Deploy em homologação, smoke test e rollback ensaiado.
5. Relatório final e autorização explícita antes de produção.

## Critério de migração de cada funcionalidade

Contrato documentado, validação de entrada, autorização server-side, RLS/grants quando houver banco, testes, observabilidade sem segredos, documentação e build verde.
