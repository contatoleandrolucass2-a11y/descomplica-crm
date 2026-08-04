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
9. **Dashboard normalizado.** O read model separa snapshot, visão, métricas e ranking de empreendimentos. A UI lê com a sessão SSR e nunca usa fallback demonstrativo.
10. **Metas mensais auditadas.** Os funis DV e parcerias compartilham uma tabela tipada por perfil/mês. A escrita ocorre por Server Action e RPC, que recalcula as etapas e audita atomicamente.
11. **Pontos normalizados.** Pesos e objetivos do ranking são linhas tipadas, legíveis por `crm.ranking.view`; a substituição integral exige `crm.settings.manage` e gera auditoria.
12. **Ranking recalculável.** O read model guarda atividades por corretor/período, não pontuações finais. Corretores e gerentes são classificados com os pesos atuais, sem regravar o snapshot.
13. **Etapas sem duplicação.** As cinco análises detalhadas leem as mesmas métricas autorizadas do dashboard; não existe uma segunda fonte ou tabela derivada para a mesma informação.
14. **Ingestão transacional.** O produtor Salesforce envia um contrato versionado a um Route Handler M2M limitado. Uma RPC exclusiva do papel de serviço substitui dashboard e ranking atomicamente, impede replay/snapshot antigo e registra execução sanitizada.
15. **Refresh sob demanda.** O navegador nunca acessa credenciais Salesforce. Sessão, permissão, origem, lock e cooldown são verificados antes de um webhook HTTPS configurado por ambiente.
16. **Preferência visual local.** Tema é estado de apresentação não sensível em `localStorage`; autorização e catálogo continuam resolvidos no servidor. O shell aplica somente três valores conhecidos e falha para claro.

## Fronteiras de segredo

Chaves públicas do Supabase podem chegar ao navegador e permanecem limitadas por grants/RLS. Secret key, service role, credenciais PostgreSQL, Salesforce refresh token e `INGEST_SECRET` existem somente em ambiente server-side/gerenciador de segredos. Nenhuma integração pode registrar token em log.

## Próximas decisões da migração

- Estratégia de dados seed/demonstração separada dos dados reais.
- Observabilidade e alertas da ingestão em homologação.
- Contrato operacional definitivo com o produtor Salesforce/n8n real.

Essas decisões serão implementadas incrementalmente nas próximas branches.
