# Registro de inspeção remota

## Declaração

Em 10 de agosto de 2026 foram realizadas somente inspeções remotas de leitura
para identificar o caller Qlik e seus consumidores. Nenhum ambiente remoto foi
alterado.

## Operações executadas

### Supabase

- consulta dos logs recentes da Data API e PostgreSQL pelo conector já
  autenticado;
- execução exclusiva de `SELECT` sobre catálogos, grants, policies e metadados
  sanitizados de runs;
- confirmação de existência e ACL da RPC legada;
- correlação temporal de runs sem consultar valores comerciais das entries ou
  developments.

Não foram executados `INSERT`, `UPDATE`, `DELETE`, DDL, migrations, grants,
revogações, rotação de chaves, alteração de policies ou chamada à RPC de
ingestão.

### n8n

- abertura do SQLite com `mode=ro`;
- leitura de metadados de workflow, versão ativa, ownership, histórico de
  publicação, nodes, credential references e execuções;
- comparação em memória de referências literais, sem imprimir ou exportar
  valores;
- consulta da versão do runtime e das opções de retenção.

Nenhum workflow foi criado, duplicado, ativado, desativado, salvo ou executado.
Nenhuma credential foi descriptografada, exportada, alterada ou criada.

### VPS e origem Qlik

- leitura de estado, unit e metadados do `qlik-ranking-api.service`;
- leitura sanitizada dos nomes das variáveis de ambiente, sem seus valores;
- inspeção estática dos arquivos do serviço e exportador;
- consulta de listeners, containers e schedulers;
- `GET /health` sem efeito de estado, retornando sucesso.

Não houve reinício de serviço, execução de exportação, alteração de arquivo,
mudança de container, firewall, VPS, DNS, Nginx ou sistema operacional.

## Evidências resultantes

- workflow confirmado: `r4DyPyOTDtoROXq0` (`ranking imobs`);
- versão ativa confirmada: `969edbee-d8ca-4a13-a91b-24bd7decbe59`;
- owner técnico confirmado: Leandro Lucas, `global:owner`;
- papel efetivo do publisher: `anon`;
- correlação: 27 de 27 execuções bem-sucedidas com runs remotos;
- upstream confirmado: `qlik-ranking-api.service`;
- nenhum backup owner encontrado;
- leituras `GET` adicionais permaneceram sem atribuição;
- literais de publicação permanecem no workflow e no histórico remoto, sem
  exposição de valores neste repositório.

## Estado preservado

Ao final da inspeção:

- workflow legado continuava ativo, sem edição;
- serviço Qlik continuava ativo, sem reinício;
- Supabase mantinha schema, dados, grants, policies e migrations inalterados;
- nenhum relay, canário, mapping ou cutover remoto havia sido ativado;
- nenhuma flag remota havia sido modificada;
- nenhum deploy, merge ou hardening destrutivo havia sido executado.

Este arquivo registra inspeções, não autoriza mutação posterior. Qualquer
cutover exige aprovação explícita e execução do runbook versionado.
