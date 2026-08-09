# Segurança

## Read model v3

As tabelas `crm_read_model_v3_*`, dimensões canônicas e mappings não recebem
grants diretos de `anon`, `authenticated` ou `service_role`; todas têm RLS e as
tabelas de fatos usam FORCE RLS. No estado versionado, porém, a credencial global
de `service_role` pode executar três capacidades públicas de ingestão:
`ingest_crm_salesforce_snapshot(jsonb)`,
`ingest_crm_imob_ranking_snapshot(jsonb)` e
`ingest_crm_read_model_v3(jsonb)`. O Route Handler implementado chama somente a
primeira, mas isso não reduz o blast radius da credencial no banco.

A ingestão v3 ainda exige uma autoridade exata, ativa e aprovada em
`private.crm_read_model_v3_sources`, com owner ativo, para a tupla
dataset/source/workflow/producer. Essa tabela falha fechado para provenance não
aprovada, mas não transforma a chave global em identidade exclusiva do
produtor. Papel de máquina ou wrapper com zero grants de tabela e uma única RPC
é mitigação futura, ainda não implantada.

O navegador executa somente RPCs de leitura, com permissão específica do
dataset, scope explícito e lineage efetivo. As permissões v3 estão no catálogo,
mas nenhum papel as herda automaticamente; até uma migration de rollout
separada, inclusive Master falha fechado. IDs desconhecidos falham fechados e
nenhuma associação por nome autoriza leitura. Esta correção documental não
alterou credencial, grant, environment ou estado remoto.

## Estado da preparação

- Segredo encontrado no ZIP do login foi removido da árvore de trabalho e colocado em quarentena local, fora do repositório de entrega. O histórico Git original não continha esse arquivo.
- Gitleaks não encontrou segredo no histórico dos dois projetos.
- A auditoria final tem zero vulnerabilidade crítica, alta, moderada ou baixa após override compatível de `@babel/core` 7.29.6.
- As vulnerabilidades altas do Next.js/React Server Components e do conjunto Cloudflare/Vite foram eliminadas pela atualização seletiva e pela exclusão controlada da pilha Cloudflare.

## Regras

1. Nunca commitar `.env.local`, dumps, certificados, ZIPs, tokens ou credenciais.
2. Usar `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no cliente. A secret key Supabase existe somente no módulo server-only da ingestão M2M e nunca entra no bundle, logs ou código cliente. O caller atual invoca uma RPC Salesforce, mas a credencial global pode executar as três RPCs de ingestão versionadas; restringi-la a uma capacidade exige papel de máquina/wrapper futuro e migration testada.
3. Validar a sessão com API confiável do Supabase no servidor (`getClaims`/`getUser` conforme o contexto), nunca confiar em `getSession` para autorização server-side.
4. Toda entrada externa passa por validação de schema; Zod é a biblioteca padrão.
5. Toda API exige autenticação e permissão explícitas, salvo endpoint documentado como público.
6. Toda tabela do schema exposto tem grants mínimos e RLS ativada/testada.
7. Integrações externas usam timeout, limite de payload, retry limitado, auditoria e erros sem detalhes internos.
8. O bootstrap do master usa conexão PostgreSQL privilegiada e não é publicado pela aplicação.
9. Usuários inativos não recebem contexto de autorização; o helper efetivo de permissões também os bloqueia dentro da RLS.
10. Alterações de papel, exceção, status e visibilidade passam por RPCs auditadas e respeitam hierarquia estrita.
11. Refresh autenticado exige `Origin` da aplicação, permissão dedicada, lock transacional e cooldown. Ingestão exige Bearer dedicado, comparação constante, corpo de até 1 MB, schema versionado, idempotência e cota global por minuto.

## Verificações locais

```bash
pnpm audit
pnpm security:secrets
pnpm security:secrets:history
pnpm security:osv
pnpm exec supabase db lint --local
pnpm exec supabase db advisors --local --type security
pnpm exec supabase db advisors --local --type performance
pnpm exec supabase inspect db table-sizes --local
```

## Resposta a segredo exposto

1. Remover o arquivo da árvore de trabalho sem apagar a evidência local necessária.
2. Revogar/rotacionar a credencial no provedor.
3. Examinar histórico Git e artefatos publicados.
4. Registrar o incidente sem copiar o valor.
5. Validar com Gitleaks antes do push.

O valor legado encontrado no ZIP deve ser considerado comprometido por ter sido transportado em arquivo compactado, mesmo não tendo sido commitado. Sua rotação é responsabilidade do proprietário do projeto Supabase correspondente.

## Relato

Não abra issue pública contendo dados sensíveis. Use o canal privado definido pelo proprietário do repositório.
