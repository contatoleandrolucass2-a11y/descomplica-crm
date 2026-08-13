# Contenção emergencial da leitura pública Qlik

## Escopo

Este registro preserva evidência sanitizada do gate P0 executado em 13 de
agosto de 2026. Nenhuma linha comercial, credencial, token, endereço de rede ou
identificador pessoal foi incluído.

As tabelas em escopo são:

- `crm_imob_ranking_runs`;
- `crm_imob_ranking_entries`;
- `crm_imob_ranking_developments`.

## Estado anterior

As três tabelas possuíam RLS ativa, sem `FORCE RLS`, `SELECT` direto para
`anon`, `authenticated` e `service_role` e uma policy de leitura para
`anon,authenticated`. As policies verificavam somente o estado concluído do
run; não verificavam identidade, permissão ou escopo organizacional.

O schema contém dados comerciais e operacionais: execução e origem, nomes ou
chaves de imobiliárias e empreendimentos, competência, VGV, contratos e
posições. Não há coluna de dado pessoal direto ou dado pessoal sensível no
catálogo. Campos livres e nomes comerciais ainda podem conter dado pessoal
incidental; isso não foi inspecionado porque o gate proíbe leitura de conteúdo.

## Exposição e logs

`runs` e `entries` provavelmente ficaram alcançáveis após as primeiras cargas
de 6 de agosto de 2026. Foram fechadas em 7 de agosto às `00:34:27Z` e reabertas
por alteração interativa às `04:00:30Z`. `developments` provavelmente ficou
alcançável desde a migration remota `20260809031936`; a exposição estava
comprovada em 9 de agosto às `05:31:42Z`.

As amostras preservadas registram pelo menos 51 requisições `GET` bem-sucedidas
e não atribuídas, além dos probes internos `HEAD` identificados separadamente.
Os logs disponíveis não informam bytes retornados, contagem de linhas ou origem
confiável suficiente para comprovar exfiltração. Acesso pela Data API foi
comprovado; abuso humano, origem externa e acesso a dado pessoal não foram.

Escalonamento imediato ao responsável por LGPD/jurídico é necessário se uma
origem externa for correlacionada a resposta contendo pessoa natural
identificada ou identificável, dado sensível, transferência, scraping ou risco
relevante. A evidência atual comprova incidente de confidencialidade comercial,
mas não comprova incidente com dados pessoais.

## Caller de escrita

O único publisher confirmado é o workflow n8n `r4DyPyOTDtoROXq0`, que chama
`publish_crm_imob_ranking(jsonb,text)`. O transporte usa papel efetivo `anon`,
sem autenticação de node, e um verificador literal do contrato. A função é
`SECURITY DEFINER`, pertence a `postgres` e continua independente de grants de
leitura nas tabelas.

Revogar `SELECT` e remover policies não interrompe tecnicamente essa RPC. Porém,
o caller não usa identidade dedicada nem menor privilégio. Preservá-lo é uma
exceção transitória; não satisfaz o estado final exigido para o cutover. Alterar
workflow, credencial ou ativar o relay permaneceu fora deste gate.

## Migration de contenção

`20260813115335_emergency_qlik_public_read_hardening.sql`:

1. mantém e força RLS nas três tabelas;
2. remove todas as policies `SELECT`/`ALL` dessas tabelas;
3. revoga todos os privilégios diretos de `PUBLIC`, `anon`, `authenticated` e
   `service_role`;
4. restringe a RPC legada ao caller temporário `anon`, revoga sua execução de
   `PUBLIC`, `authenticated` e `service_role` e fixa `search_path` em
   `pg_catalog, extensions, pg_temp`;
5. não altera dados, corpo da RPC, usuários, credenciais, integrações ou RBAC
   do Canal de Parcerias.

Leituras permanecem fechadas até existir RPC explicitamente permissionada e
escopada. Leitura pública nunca faz parte do rollback.

## Backup e restore

Backup lógico completo e histórico de migrations foram gravados em diretório
`root:root 0700`, com arquivos `0600` e manifesto SHA-256 `0600`. O restore
isolado usa PostgreSQL 17.6, sem conexão com redes externas.

Contagens e hashes canônicos das três tabelas coincidiram antes da migration e
permaneceram idênticos depois dela. O pgTAP emergencial aprovou 28 de 28 casos:
zero leitura direta por `anon`, `authenticated` e `service_role`, zero policy
de leitura, RLS e `FORCE RLS` nas três tabelas, ACL mínima da RPC, verificador
fail-closed, ausência de SQL dinâmico/log sensível, referências qualificadas e
`search_path` seguro quando o contrato legado existe no restore remoto.

## Exceção transitória autorizada

O restore comprova que a contenção preserva tecnicamente a RPC legada. A missão
de ativação autorizou explicitamente esse caller `anon` somente como ponte P0,
com execução restrita e posterior substituição por identidade dedicada. Essa
exceção não atende ao estado final do Qlik e não autoriza leitura pública,
cutover, remoção do verificador ou ativação do relay antes de shadow e canário.

## Roll-forward

Rollback por reabertura pública é proibido. Se um leitor legítimo falhar, ele
permanece indisponível até receber uma RPC autenticada, permissionada e
escopada. A escrita deve migrar para identidade dedicada por gate separado,
com owner, backup, credencial privada, canário e rotação do verificador legado.
