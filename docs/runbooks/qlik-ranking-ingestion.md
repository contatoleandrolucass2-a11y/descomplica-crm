# Ingestão do ranking Qlik

## Estado e causa raiz

As tabelas `crm_imob_ranking_runs`, `crm_imob_ranking_entries` e
`crm_imob_ranking_developments` não integram a allowlist de leitura ou escrita
direta da Data API proposta. A prova remota de 9 de agosto de 2026 confirmou
grants/policies anônimos e atividade recente da RPC legada como role `anon`,
mas não identificou o caller com segurança. O cutover fica bloqueado até haver
owner e processo comprovados.

O workflow legado `ranking imobs` (`r4DyPyOTDtoROXq0`) usa três nodes Supabase
para criar um run, inserir linhas e concluir o run. A credencial observada aponta
ao projeto antigo `jzejdijkdesltcuoxcoj`; ela não deve ser reutilizada no CRM
novo. O workflow possui gatilho manual/recursivo de 60 minutos, mas não tinha
execução registrada na auditoria.

## Contrato permitido

O único contrato interno de escrita no banco novo é:

```text
POST /rest/v1/rpc/ingest_crm_imob_ranking_snapshot
```

Esse caminho não autoriza o n8n externo a portar `service_role`, secret key do
Supabase ou qualquer credencial com `BYPASSRLS`. O desenho preferencial é:

1. n8n autentica em um relay HTTPS server-side com credencial M2M exclusiva,
   curta, rotacionável e limitada à ingestão Qlik;
2. o relay valida origem, audience, replay, payload e limites;
3. somente o relay chama a RPC interna;
4. a credencial Supabase permanece no ambiente server-only e nunca entra em
   node, export, log ou argumento de processo do n8n.

Alternativa exige revisão de segurança específica: credencial de máquina
mapeada para um papel DB dedicado, sem `BYPASSRLS`/herança privilegiada e com
somente `USAGE` mínimo de schema e `EXECUTE` nessa assinatura de RPC. Esse papel
não recebe tabela, sequência, outras funções nem capacidade de assumir
`service_role`. Entregar `service_role` diretamente ao n8n é proibido em todos
os casos.

O payload v1 contém `requestId`, ano, timestamps, `entries` e opcionalmente
`developments`. A RPC fixa
`source=qlik`, `regional=SP CAPITAL` e `company=Direcional`, valida até 5.000
linhas por array e no máximo 8 MiB no banco. Chaves/unidade aceitam até 128
caracteres, nomes até 256, e VGV exige faixa `numeric(18,2)` sem arredondamento
implícito. O relay deve rejeitar body HTTP acima de 8 MiB antes de parsear JSON;
o limite `pg_column_size` é defesa adicional. A RPC persiste
run/entries/developments em uma única transação.
Repetir o mesmo payload e
identificador é idempotente; reutilizar o identificador com conteúdo diferente
falha sem mutação.

## Preparação e troca segura do workflow

1. Exportar workflow, versão ativa, estado de execução e metadados da credencial
   para backup root-only, com SHA-256. Nunca exportar credencial descriptografada.
2. Duplicar o workflow como candidata inativa.
3. Manter o exportador HTTP e a validação/normalização do snapshot.
4. Substituir os três nodes de escrita direta por um único HTTP Request para o
   relay server-side, usando somente a credencial M2M Qlik. Se a alternativa de
   papel DB limitado for formalmente aprovada, documentar sua ACL exata.
5. Remover da candidata qualquer node que cite diretamente as três tabelas.
6. Executar manualmente uma vez. Exigir HTTP 200, `status=succeeded`, contagem
   reconciliada, nenhum grant novo e prova de que o processo n8n não possui
   `service_role`/secret key Supabase.
7. Repetir exatamente o mesmo payload e exigir `idempotent=true`, sem novo run
   ou entry.
8. Somente após pgTAP, lint, advisors e matriz de grants aprovados, ativar a
   candidata e iniciar uma execução real. Observar sua conclusão antes de
   desativar o workflow anterior.

É proibido resolver falhas de leitura/escrita com `GRANT` direto ou ampliando
roles das policies. Mudanças de ACL, policy ou RPC exigem migration e CI.

## Gates após cada execução

- RLS ativa nas 31 tabelas públicas e 25 policies nomeadas;
- `PUBLIC`/`anon` sem privilégios nos objetos públicos;
- `authenticated` restrita à allowlist documentada;
- n8n externo sem `service_role`, secret key ou CRUD direto em tabelas;
- relay server-side com credencial M2M validada ou papel DB dedicado limitado à
  assinatura de ingestão, sem tabela/sequência;
- `service_role`, quando ainda necessário internamente, confinado ao ambiente
  server-only e nunca distribuído ao workflow;
- Qlik sem grants diretos nem policies de tabela; leitura humana somente pela
  RPC escopada;
- runs/entries/developments anteriores preservados e contagens reconciliadas;
- Salesforce, Auth, papéis, Qlik histórico e auditoria sem alteração indevida;
- logs e exports sem segredo.

## Rollback

1. Desativar a candidata sem apagar seu histórico.
2. Reativar o workflow anterior somente contra o projeto antigo, se necessário.
3. Não restaurar grants diretos no projeto novo.
4. A RPC nova pode permanecer inerte; sem `EXECUTE` do caller e sem workflow
   ativo ela não realiza chamadas nem altera dados.
5. Restaurar configuração n8n apenas do backup root-only verificado, sem
   reintroduzir credencial `service_role`.

Rollback não apaga runs, entries ou developments. Qualquer exclusão exige
autorização destrutiva separada.
