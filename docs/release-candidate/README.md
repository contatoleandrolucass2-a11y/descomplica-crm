# Release candidate — gates E2E

## Estado

Este incremento prepara uma release candidate local sobre
`d00118fe62296fa3e23e266585899e3ee3a78478`. Não autoriza merge, migration
remota, alteração de workflow, cutover ou deploy.

Flags permanecem desligadas por padrão:

- `CRM_READ_MODEL_V3_SHADOW_ENABLED=false`;
- `QLIK_RELAY_MODE=off`;
- `QLIK_RELAY_WRITE_ENABLED=false`;
- `COMMERCIAL_ENGINE_RUNTIME_MODE=off`;
- `COMMERCIAL_ENGINE_ENABLED_KEYS` vazia;
- URLs e credenciais dedicadas vazias.

## Gates versionados

- Playwright real: login inválido, acesso anônimo, logout, nove perfis, matriz
  exata das 21 rotas/navegação autorizadas, Dashboard, cinco etapas, Ranking,
  Canal, filtros, rotas v3 desligadas e endpoints relay/motores indisponíveis.
- Matriz visual existente: 18 rotas, `1440×900`, `1280×720`, `768×1024`,
  `390×844`, três temas, reduced-motion, teclado e reflow equivalente a zoom de
  200%, com auditoria WCAG A/AA e comparação pixel a pixel contra o baseline
  versionado. A verificação usa candidatos separados e nunca regrava o baseline;
  promoção exige comando local explícito e todos os checks verdes.
- REST/RLS: nove perfis, oito superfícies anônimas, isolamento organizacional,
  escopos, v2 Master-only e onboarding pending.
- Relay: HTTP/HMAC/replay/rate limit em testes de handler e RPC/replay/rate
  limit/canário em pgTAP. O caminho positivo HTTP→DB permanece bloqueado porque
  exige TLS e credencial privada do papel dedicado; nenhum bypass local foi
  criado.
- Motores: endpoint e UI bloqueados no runtime real; execução positiva existe
  somente em fixtures transacionais/unitárias, com políticas e casos de ouro
  sintéticos. Nenhuma regra comercial foi incorporada.
- Banco: 26 migrations em dois projetos/containers Supabase/PostgreSQL 17
  efêmeros e independentes, com 863 pgTAP, lint e advisors na origem e no alvo,
  backup/restore lógico, owners e privilégios efetivos preservados e fingerprint
  canônico idêntico. O ensaio não aplica GRANT corretivo no alvo.

## Artefatos

- [Auditoria integral](STACK_AUDIT.md)
- [Pacote único de aprovações](APPROVAL_PACKAGE.md)
- [Merge train, canário, rollback e deploy](RELEASE_RUNBOOK.md)
- [Resultado do restore isolado](isolated-restore-results.json)
- [Matriz de migrations](../reconciliation/MIGRATION_MATRIX.md)

## Limite da evidência

O restore versionado usa duas stacks locais vazias e reproduzíveis. Ele prova a
portabilidade lógica da árvore local, não um restore representativo de produção
nem a convergência do histórico remoto. O restore exato de produção continua
exigindo um novo backup privado e autorizado; o DDL remoto sanitizado não é
backup executável. Toda ativação segue bloqueada até o pacote de aprovações
estar completo.
