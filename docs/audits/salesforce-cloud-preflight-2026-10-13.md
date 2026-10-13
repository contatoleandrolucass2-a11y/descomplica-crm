# Salesforce: preflight cloud e plano para revisao

Status: backup e ensaio isolado comprovados; configuracao cloud nao aplicada.
Fonte: MCP Supabase em 13/10/2026, checkout 81e31af e origin/main 7c50f59,
CLI Supabase 2.115.0 e PostgreSQL 17.6.1.155 na VPS. N8n antigo intocado.

## Backup e limites

Projeto: `hnncxuerlcsaahdxoswb`, descomplica-crm-production.
Destino root700 na VPS:
`/srv/descomplica-backups/supabase-pre-salesforce-20261013-h0umc6`.
Arquivos root600: schema, dados, roles, schemas gerenciados e historico.
`verification.json` privado registra SHA256 e contagens esperadas/restauradas
das 65 tabelas COPY; todas coincidiram. Checksums relidos e fsync confirmado.
Restore com erro interrompeu/reverteu a primeira transacao por role de plataforma
ausente; apos criar somente essa role no container isolado, restore integral
em transacao passou. Nenhuma alteracao equivalente no banco remoto.

Sem rede, portas ou volume persistente no container de restore. Dados nao sairam
da VPS. Limites: schema e dados exportados separadamente, sem snapshot comum;
sem bytes de objetos Storage, sem backup externo, sem prova de boot da aplicacao
restaurada ou descriptografia Vault. Nao classificar como recuperacao de desastre.

## Ensaio com dados reais

Exportacao dos sete relatorios terminou em `2026-10-13T04:12:59Z`, sem publisher.
Request `7fefa339-a000-4fdf-b7b5-7bce3231b1dd`, snapshot
`2026-10-13T04:10:53.806Z`. RPC executada como service_role somente na copia:

- primeira chamada: succeeded, recordCount159;
- persistidos: 15 metricas, 144 participantes;
- segunda chamada: succeeded, idempotenttrue;
- apenas um registro de ingestao para o mesmo request.

Nao houve teste HTTP real no endpoint de producao nem persistencia cloud.
pgTAP secure_ingestion sobre o clone com dados nao substitui suite limpa: os
13 primeiros checks passaram, mas fixture encontrou run preexistente e trigger
de aceite legal. A transacao dessa tentativa foi revertida.

## Catalogo e permissoes remotas

MCP lista 36 migrations, incluindo 20260804052500, 20260806222732 e
20261013035612 (crm_shared_routines). Existem migrations cloud de contencao Qlik
sem correspondencia identica com o encadeamento local. Nao usar db push global.

RPC `public.ingest_crm_salesforce_snapshot(jsonb)`: service_role pode executar;
anon/authenticated nao. Nove tabelas Salesforce/Qlik/ingestion inspecionadas
tem RLS. Anon nao tem acesso direto. Service_role nao tem acesso direto a
essas tabelas. As duas tabelas Qlik tambem negam acesso direto a authenticated.
Authenticated tem grants de leitura nos snapshots Salesforce, sujeitos a RLS;
esta inspecao de ACL nao substitui o teste funcional das policies.

Ausentes: `ingest_crm_imob_ranking_snapshot` e `ingest_crm_read_model_v3`.
Ausencia confirmada no catalogo, nao inferida apenas pelo historico.

## Migrations: preparar nao significa aplicar

O usuario autorizou auditoria e preparacao para revisao, nao aplicacao automatica.
Nao foi criado SQL duplicado nem migration vazia para simular convergencia.
O conjunto versionado potencialmente pertinente e:

| Contrato         | Fonte versionada               | Decisao proposta                                                           |
| ---------------- | ------------------------------ | -------------------------------------------------------------------------- |
| Salesforce v1/v2 | 20260804052500, 20260806222732 | Ja implantado; nao reaplicar                                               |
| Qlik atomico     | 20260807185611, 20260809144143 | Revisar em cutover Qlik separado, confrontando contencoes cloud            |
| Read model v3    | 20260809181422, 20260809181424 | Manter fora deste fluxo; exige mappings/fontes aprovados e cutover proprio |

Evidencia de dependencia: `app/api/ingest/salesforce/route.ts` chama somente a
RPC Salesforce. Seu wrapper v2 chama a funcao v1 privada, sem depender de Qlik
ou v3. `docs/INGESTION.md`, secao Contrato v3 aditivo, declara implantacao local
e nenhum caller remoto migrado. O engine comercial e uma fronteira separada,
conforme `docs/INTEGRATIONS.md`; nao e destino substituto dessas RPCs.

Proposta para revisao: tornar o item 2 do runbook especifico ao fluxo Salesforce,
mantendo grants minimos, RLS, RPC privada e proibicao de acesso direto Qlik.
Nao remover o gate sem revisar/registrar essa mudanca de escopo. Instalar Qlik/v3
somente para satisfazer esse item ampliaria risco sem dependencia tecnica.

## Condicoes restantes

1. Revisar o gate e o escopo remoto, sem migrations automaticas.
2. Concluir PR/CI; aplicar configuracao privada via release protegida, com backup
   e rollback da configuracao, refreshfalse e publisher/agenda desligados.
3. Resolver destino externo autorizado para backup do novo n8n antes de trafegar
   dados comerciais, conforme n8n-crm-isolated.md. Backup no mesmo disco nao basta.
4. Validar schema completo e MFA vigente; enviar uma carga pelo novo n8n,
   exigir 201/mesmo requestId, reconciliar banco, depois replay200/idempotenttrue.
5. Somente apos essas provas liberar agenda com exclusao mutua e falha fechada.

O workflow `L90AYSBEat4vYHLz` foi relido por MCP: cinco nodes, inativo,
activeVersionIdnull, versao dcffaf09-354c-4a82-817c-5e6ca9da1dd5; sem persistencia
de execucoes e sem agenda. Nenhum workflow foi modificado nesta auditoria.
