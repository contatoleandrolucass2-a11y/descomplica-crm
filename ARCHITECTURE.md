# Arquitetura

## Decisão

O sistema de login é a fundação da aplicação final. Ele já contém autenticação SSR, autorização, migrations, RLS e auditoria. O CRM original será tratado como fonte de páginas, componentes e regras de negócio, não como fundação de runtime.

## Componentes alvo

```mermaid
flowchart LR
    B["Navegador"] --> N["Next.js App Router"]
    N --> A["Supabase Auth"]
    N --> P["PostgreSQL + RLS"]
    N --> I["Integrações server-side"]
    G["GitHub Actions"] --> H["Hostinger VPS - homologação"]
    H --> M["PM2 + Next standalone"]
    X["Nginx + HTTPS"] --> M
```

## Decisões registradas

1. **Next.js nativo.** Vinext/Vite eram uma camada específica da geração Cloudflare e produziam incompatibilidades com módulos `cloudflare:` e a data de compatibilidade. Foram excluídos da arquitetura alvo.
2. **Supabase em vez de D1.** O banco final é PostgreSQL, com migrations SQL, grants e RLS. Drizzle/D1 não será copiado automaticamente; cada modelo do CRM terá migration revisada.
3. **Autenticação única.** O fluxo Supabase SSR da base substitui cookies e rotas de autenticação manuais do CRM.
4. **Autorização em profundidade.** Menus e páginas respeitam permissões, mas APIs, Server Actions e RLS também as impõem.
5. **Deploy `standalone` em VPS.** PM2 é suficiente para o KVM 1 e reduz a sobrecarga de runtime. Docker continua necessário para o Supabase local, não para executar o app na VPS.
6. **Versões exatas.** `package.json` e lockfile fixam a base homologada; atualizações futuras serão seletivas e testadas.
7. **Catálogo autorizado.** `app_pages` é a fonte da navegação. RLS filtra páginas pela permissão efetiva; guardas de rota e RPCs continuam sendo as fronteiras de segurança.
8. **Provisionamento mínimo.** Novas contas Auth recebem perfil ativo e papel `user`. O painel só modifica alvos abaixo do nível do ator e toda mutação é auditada.

## Fronteiras de segredo

Chaves públicas do Supabase podem chegar ao navegador e permanecem limitadas por grants/RLS. Secret key, service role, credenciais PostgreSQL, Salesforce refresh token e `INGEST_SECRET` existem somente em ambiente server-side/gerenciador de segredos. Nenhuma integração pode registrar token em log.

## Próximas decisões da migração

- Modelo PostgreSQL para metas, pontos e dashboard.
- Contratos de ingestão e Salesforce com autenticação, autorização, rate limiting, timeout, retry e auditoria.
- Estratégia de dados seed/demonstração separada dos dados reais.

Essas decisões serão implementadas incrementalmente nas próximas branches.
