# Mapa de São Paulo temporariamente restrito

Data: 26/10/2026

## Comportamento

- Master vê o cadeado, acessa o Mapa de São Paulo e recebe aviso de manutenção.
- Papéis abaixo de Master veem o mesmo item na navegação, sem navegação ativa.
- Hover, foco, nome acessível e `title` informam: “Página temporariamente
  desabilitada para melhorias. Consulte o desenvolvedor para mais informações.”
- Uma URL direta com `?panel=map` redireciona usuários abaixo de Master para a
  visão macro do Meta Ads.

## Limites

O bloqueio é temporário e específico ao painel do mapa. Visão macro, campanhas,
ajustes, relatórios, permissões persistidas e integrações permanecem inalterados.
Master recebe acesso somente de visualização já existente; esta entrega não
altera dados, contas, anúncios ou configuração da API Meta.

## Verificação

- `pnpm exec vitest run tests/meta-ads-dashboard.test.tsx`: 18 testes aprovados.
- `pnpm lint`: sem erros; 36 avisos preexistentes nos scripts estáticos do Meta Ads.
- `pnpm typecheck`: aprovado.
- `pnpm test`: 4.293 testes Vitest e 727 testes operacionais/release aprovados;
  110 e 14 testes condicionais ignorados, respectivamente.
- `node scripts/qa/meta-ads-frame.mjs`: dashboard completo aprovado, inclusive
  navegação, mapa, filtros, alertas e exportação.
- `pnpm build`: catálogo com 41 páginas e build Next.js aprovados.
- PR, CI e publicação devem ser registrados após sua conclusão.
