# Changelog

Todas as alterações relevantes deste projeto serão registradas aqui.

## [Não publicado]

### Adicionado

- Vitest e testes iniciais dos schemas de autenticação.
- Scripts de verificação, auditoria, scanners e Supabase local.
- Build Next.js `standalone` para a VPS.
- Documentação reproduzível de ambiente, arquitetura, banco, segurança, integrações, backup e migração.
- Workflow GitHub Actions com todos os gates obrigatórios da base.
- Catálogo PostgreSQL com 14 páginas e navegação filtrada por permissão efetiva.
- Painel administrativo inicial para papéis, exceções, status de usuários e visibilidade de páginas.
- Provisionamento automático de perfil e papel mínimo para novas contas Supabase Auth.
- Rotas protegidas para todas as superfícies inventariadas do CRM.
- Dashboard comercial server-rendered com três visões, três períodos, metas, conversões e destaques.
- Read model PostgreSQL normalizado do dashboard com quatro tabelas, constraints, grants e RLS.
- Metas mensais dos funis DV e parcerias com tabela tipada, cálculo server-side e histórico por mês.
- Server Action e RPC de metas protegidas por `crm.settings.manage`, RLS e auditoria atômica.
- Configuração normalizada de pesos e objetivos das sete atividades do ranking.
- Server Action e RPC de pontos com substituição integral, validação e auditoria atômica.
- Ranking server-rendered de corretores e gerentes, com quatro períodos, pódio e placar completo.
- Read model normalizado de atividades do ranking, recalculado com os pesos atuais.
- Detalhes server-rendered das cinco etapas com visões, períodos, conversão e comparações históricas.

### Alterado

- Base fixada em Node 24.19.0, pnpm 11.20.0, Next.js 16.3.0, React 19.2.8 e Supabase SDK 2.112.0.
- Supabase SSR passou a usar a publishable key e validação de claims no middleware.
- Política de scripts de instalação e overrides transitivos de segurança centralizados no workspace pnpm.
- Policies SELECT duplicadas consolidadas sem ampliar acesso.
- Dependências D1/JSON e `sf_relatorio_resumo` removidas do caminho de leitura do dashboard.
- API pública `/api/settings/goals` substituída pelo SDK SSR e pela RPC auditada.
- API D1 `/api/settings/points` substituída pelo SDK SSR e pela RPC auditada.

### Segurança

- Removidas vulnerabilidades críticas/altas/moderadas conhecidas da árvore final.
- Arquivo de ambiente presente no ZIP de origem removido da árvore de entrega e colocado em quarentena local.
- Usuários inativos bloqueados no contexto de autorização e na resolução de permissões usada pela RLS.
- Mutações administrativas protegidas por guarda server-side, RPC hierárquica e auditoria no banco.
- Escrita direta das metas revogada para o navegador; perfil inativo ou sem permissão falha fechado.
- Pesos do ranking expostos somente para leitores autorizados; escrita direta permanece revogada.
- Snapshots e participantes do ranking protegidos por `crm.ranking.view`, sem fallback demonstrativo.
