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

1. Mapear schema D1/Drizzle para PostgreSQL.
2. Criar migrations Supabase revisáveis, grants e policies RLS.
3. Migrar metas, pontos, ranking e status do dashboard.
4. Substituir APIs manuais por Route Handlers/Server Actions autenticados.
5. Migrar ingestão e Salesforce com segredos server-side e controles de abuso.

## Gate 3 — interface

1. Migrar layout e componentes reutilizáveis.
2. Migrar páginas por domínio, preservando responsividade.
3. Remover dados demo e usuário hard-coded.
4. Integrar navegação e ações à matriz de permissões.

## Gate 4 — entrega

1. Testes unitários, integração, E2E, acessibilidade e responsividade.
2. CI GitHub e proteção de branch.
3. Backup e preparação da VPS Hostinger.
4. Deploy em homologação, smoke test e rollback ensaiado.
5. Relatório final e autorização explícita antes de produção.

## Critério de migração de cada funcionalidade

Contrato documentado, validação de entrada, autorização server-side, RLS/grants quando houver banco, testes, observabilidade sem segredos, documentação e build verde.
