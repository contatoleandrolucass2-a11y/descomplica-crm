# Contribuição

## Preparação

```bash
nvm use
corepack enable
pnpm install --frozen-lockfile
pnpm db:start
```

## Branches e commits

- Use uma branch por etapa ou correção.
- Mantenha commits pequenos e sem artefatos gerados, caches ou segredos.
- Mensagens recomendadas: `tipo(escopo): ação`, por exemplo `feat(auth): aplica permissão na rota`.
- Não reescreva checkpoints de origem.

## Qualidade obrigatória

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm audit
pnpm build
```

Alteração de schema inclui migration, grants, RLS, teste local e atualização de `docs/DATABASE.md`. Nova dependência exige justificativa no `WORKLOG.md` e lockfile atualizado por pnpm.

## Pull request

Descreva escopo, riscos, testes, mudanças de banco, variáveis de ambiente e plano de rollback. Não faça merge com CI falhando ou revisão de segurança pendente.
