# Backup e restauração

## Código

- Repositório Git público com tags de checkpoints.
- Bundles offline das duas origens em `../source-checkpoints/` no pacote entregue.
- ZIPs originais preservados fora do repositório; seus hashes constam no `WORKLOG.md`.

Teste do bundle:

```bash
git bundle verify ../source-checkpoints/sistema-login-original.bundle
git bundle verify ../source-checkpoints/descomplica-crm-original.bundle
```

## Banco local

O banco local pode ser reconstruído por migrations e seed:

```bash
pnpm db:start
pnpm exec supabase db reset
```

## Banco remoto

Antes de migration em homologação/produção:

1. Registrar versão da aplicação e lista de migrations.
2. Criar backup lógico/gerenciado e verificar conclusão.
3. Testar restauração em ambiente isolado quando o risco for material.
4. Aplicar migration revisada e monitorar.
5. Manter aplicação anterior compatível durante a janela de rollback.

Nunca restaure dump de produção sobre ambiente errado. Restauração remota é ação destrutiva e exige confirmação explícita.

## Aplicação na VPS

Manter imagens Docker imutáveis identificadas pelo SHA. Para rollback, selecione
a tag anterior e execute o Compose com `--no-build`. Retenha logs e artefatos
suficientes para diagnóstico, sem credenciais.
