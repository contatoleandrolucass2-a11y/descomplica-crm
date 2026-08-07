# Ingestão do ranking Qlik

## Estado e causa raiz

As tabelas `crm_imob_ranking_runs` e `crm_imob_ranking_entries` não integram a
allowlist de leitura ou escrita direta da Data API. Em 7 de agosto de 2026, uma
sessão interativa do conector Supabase/Codex recriou `SELECT` de `anon` e
`authenticated` e incluiu `anon` nas duas policies. Os logs identificam a
origem como `POST /mcp`; nenhum serviço Qlik ou workflow executou esse DDL.

O workflow legado `ranking imobs` (`r4DyPyOTDtoROXq0`) usa três nodes Supabase
para criar um run, inserir linhas e concluir o run. A credencial observada aponta
ao projeto antigo `jzejdijkdesltcuoxcoj`; ela não deve ser reutilizada no CRM
novo. O workflow possui gatilho manual/recursivo de 60 minutos, mas não tinha
execução registrada na auditoria.

## Contrato permitido

O único escritor autorizado no projeto novo é:

```text
POST /rest/v1/rpc/ingest_crm_imob_ranking_snapshot
```

O caller usa uma credencial `supabaseApi` dedicada ao projeto
`hnncxuerlcsaahdxoswb`. O valor da secret key nunca entra em node, export,
repositório, log ou argumento de processo. O node HTTP usa autenticação
`predefinedCredentialType` e referencia apenas o identificador interno da
credencial protegida do n8n.

O payload v1 contém `requestId`, ano, timestamps e o array `entries`. A RPC fixa
`source=qlik`, `regional=SP CAPITAL` e `company=Direcional`, valida até 5.000
linhas e persiste run/entries em uma única transação. Repetir o mesmo payload e
identificador é idempotente; reutilizar o identificador com conteúdo diferente
falha sem mutação.

## Preparação e troca segura do workflow

1. Exportar workflow, versão ativa, estado de execução e metadados da credencial
   para backup root-only, com SHA-256. Nunca exportar credencial descriptografada.
2. Duplicar o workflow como candidata inativa.
3. Manter o exportador HTTP e a validação/normalização do snapshot.
4. Substituir os três nodes de escrita direta por um único HTTP Request para a
   RPC acima, usando a credencial dedicada do projeto novo.
5. Remover da candidata qualquer node que cite diretamente as duas tabelas.
6. Executar manualmente uma vez. Exigir HTTP 200, `status=succeeded`, contagem
   reconciliada e nenhum grant novo.
7. Repetir exatamente o mesmo payload e exigir `idempotent=true`, sem novo run
   ou entry.
8. Somente após pgTAP, lint, advisors e matriz de grants aprovados, ativar a
   candidata e iniciar uma execução real. Observar sua conclusão antes de
   desativar o workflow anterior.

É proibido resolver falhas de leitura/escrita com `GRANT` direto ou ampliando
roles das policies. Mudanças de ACL, policy ou RPC exigem migration e CI.

## Gates após cada execução

- RLS ativa nas 20 tabelas públicas e 19 policies nomeadas;
- `PUBLIC`/`anon` sem privilégios nos objetos públicos;
- `authenticated` restrita à allowlist documentada;
- `service_role` sem tabela/sequência e apenas com as duas RPCs de ingestão;
- Qlik sem grants diretos e policies somente para `authenticated`;
- runs/entries anteriores preservados e novo `row_count` igual às entries;
- Salesforce, Auth, papéis, Qlik histórico e auditoria sem alteração indevida;
- logs e exports sem segredo.

## Rollback

1. Desativar a candidata sem apagar seu histórico.
2. Reativar o workflow anterior somente contra o projeto antigo, se necessário.
3. Não restaurar grants diretos no projeto novo.
4. A RPC nova pode permanecer inerte; sem `EXECUTE` do caller e sem workflow
   ativo ela não realiza chamadas nem altera dados.
5. Restaurar configuração n8n apenas do backup root-only verificado.

Rollback não apaga runs ou entries. Qualquer exclusão exige autorização
destrutiva separada.
