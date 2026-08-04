# Inventário de dependências

Data do inventário: 2026-08-03. O `pnpm-lock.yaml` é o inventário transitivo completo e reproduzível da base final.

## Sistema de login original

| Tipo            | Pacote                        | Especificação original | Versão resolvida |
| --------------- | ----------------------------- | ---------------------: | ---------------: |
| runtime         | `@supabase/ssr`               |              `^0.10.3` |           0.10.3 |
| runtime         | `@supabase/supabase-js`       |             `^2.105.4` |          2.105.4 |
| runtime         | `next`                        |               `16.2.6` |           16.2.6 |
| runtime         | `react`                       |               `19.2.4` |           19.2.4 |
| runtime         | `react-dom`                   |               `19.2.4` |           19.2.4 |
| runtime         | `zod`                         |               `^4.4.3` |            4.4.3 |
| desenvolvimento | `@tailwindcss/postcss`        |                   `^4` |            4.3.0 |
| desenvolvimento | `@types/node`                 |                  `^24` |          24.12.4 |
| desenvolvimento | `@types/react`                |                  `^19` |          19.2.14 |
| desenvolvimento | `@types/react-dom`            |                  `^19` |           19.2.3 |
| desenvolvimento | `eslint`                      |                   `^9` |           9.39.4 |
| desenvolvimento | `eslint-config-next`          |               `16.2.6` |           16.2.6 |
| desenvolvimento | `prettier`                    |                   `^3` |            3.8.3 |
| desenvolvimento | `prettier-plugin-tailwindcss` |                 `^0.6` |           0.6.14 |
| desenvolvimento | `tailwindcss`                 |                   `^4` |            4.3.0 |
| desenvolvimento | `typescript`                  |                   `^5` |            5.9.3 |

Ausência identificada: script/framework de testes. O projeto possuía somente `pnpm-lock.yaml` e já usava pnpm.

## CRM original

| Tipo            | Pacote                     |   Versão | Classificação                                                    |
| --------------- | -------------------------- | -------: | ---------------------------------------------------------------- |
| runtime         | `drizzle-orm`              |   0.45.2 | exclusivo da persistência D1; substituir por Supabase/PostgreSQL |
| runtime         | `next`                     |   16.2.6 | manter conceito, atualizar seletivamente                         |
| runtime         | `react`                    |   19.2.6 | manter conceito, alinhar à correção de segurança                 |
| runtime         | `react-dom`                |   19.2.6 | manter conceito, alinhar à correção de segurança                 |
| desenvolvimento | `@cloudflare/vite-plugin`  |   1.37.1 | Cloudflare; remover                                              |
| desenvolvimento | `@tailwindcss/postcss`     |    4.2.1 | duplicado com a base; alinhar                                    |
| desenvolvimento | `@types/node`              | 22.19.19 | incompatível com runtime final Node 24; alinhar                  |
| desenvolvimento | `@types/react`             |  19.2.14 | manter                                                           |
| desenvolvimento | `@types/react-dom`         |   19.2.3 | manter                                                           |
| desenvolvimento | `@vitejs/plugin-react`     |    6.0.2 | Vite/Vinext; remover                                             |
| desenvolvimento | `@vitejs/plugin-rsc`       |   0.5.26 | Vite/Vinext; remover                                             |
| desenvolvimento | `drizzle-kit`              |  0.31.10 | D1/Drizzle; remover                                              |
| desenvolvimento | `eslint`                   |   9.39.4 | alinhar                                                          |
| desenvolvimento | `eslint-config-next`       |   16.2.6 | alinhar ao Next                                                  |
| desenvolvimento | `react-server-dom-webpack` |   19.2.6 | duplicação interna do runtime; remover dependência direta        |
| desenvolvimento | `tailwindcss`              |    4.2.1 | duplicado com a base; alinhar                                    |
| desenvolvimento | `typescript`               |    5.9.3 | manter                                                           |
| desenvolvimento | `vinext`                   |   0.0.50 | arquitetura Cloudflare; remover                                  |
| desenvolvimento | `vite`                     |   8.0.13 | arquitetura Vinext; remover                                      |
| desenvolvimento | `wrangler`                 |   4.92.0 | Cloudflare; remover                                              |

O CRM usava npm e `package-lock.json`; o artefato final não os contém. O pacote Cloudflare/Vinext trazia dependências vulneráveis e incompatíveis com o runtime final, além de imports `cloudflare:workers`, bindings D1 e configuração Wrangler.

## Base final homologada

### Runtime

| Pacote                  |  Versão | Uso comprovado                              |
| ----------------------- | ------: | ------------------------------------------- |
| `@supabase/ssr`         |  0.12.4 | clientes browser/server e cookies SSR       |
| `@supabase/supabase-js` | 2.112.0 | Auth e API PostgreSQL                       |
| `next`                  |  16.3.0 | framework App Router e build standalone     |
| `react`                 |  19.2.8 | interface                                   |
| `react-dom`             |  19.2.8 | renderização Next.js                        |
| `sharp`                 |  0.35.3 | otimização de imagens no runtime standalone |
| `zod`                   |   4.4.3 | validação de formulários e futuras APIs     |

### Desenvolvimento

| Pacote                        |  Versão | Uso comprovado           |
| ----------------------------- | ------: | ------------------------ |
| `@tailwindcss/postcss`        |   4.3.0 | pipeline CSS             |
| `@types/node`                 | 24.12.4 | tipos do runtime         |
| `@types/react`                | 19.2.14 | tipos React              |
| `@types/react-dom`            |  19.2.3 | tipos React DOM          |
| `eslint`                      |  9.39.5 | lint                     |
| `eslint-config-next`          |  16.3.0 | regras Next              |
| `prettier`                    |   3.8.3 | formatação               |
| `prettier-plugin-tailwindcss` |  0.6.14 | ordenação de classes     |
| `supabase`                    | 2.111.0 | banco local e migrations |
| `tailwindcss`                 |   4.3.0 | estilos                  |
| `typescript`                  |   5.9.3 | typecheck                |
| `vitest`                      |  4.1.10 | testes unitários         |

## Ausentes, incompatíveis, duplicadas, obsoletas e desnecessárias

- **Ausentes:** Vitest/script `test`, Supabase CLI local, `sharp` para standalone, scanners e scripts de auditoria. Foram adicionados porque têm uso verificável.
- **Incompatíveis:** Cloudflare/Vinext/Vite/D1, Node 22 do CRM e React Server DOM direto. Não entram na base final.
- **Duplicadas:** duas versões/origens de Next, React, Tailwind, TypeScript e ESLint foram consolidadas.
- **Obsoletas para o alvo:** `vinext`, Wrangler, plugins Vite/RSC, Drizzle D1 e `package-lock.json`.
- **Exclusivas Cloudflare:** `@cloudflare/vite-plugin`, Wrangler e todos os bindings/imports `cloudflare:`.
- **Não instaladas:** bibliotecas de UI, E2E, ORM alternativo, SDK Salesforce e PM2 local. Serão adicionadas apenas quando uma funcionalidade ou alvo operacional comprovar a necessidade.

## Política transitiva

O pnpm resolveu 514 pacotes após deduplicação. Overrides mínimos corrigem faixas vulneráveis de `@babel/core`, `brace-expansion` e `postcss`; nenhum `--force` ou `--legacy-peer-deps` foi usado. Scripts de instalação são permitidos apenas para quatro pacotes explicitamente necessários. Atualizações de maior versão, TypeScript experimental e ESLint incompatível não foram adotadas.
