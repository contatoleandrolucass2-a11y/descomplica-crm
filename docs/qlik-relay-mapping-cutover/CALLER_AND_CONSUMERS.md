# Caller e consumidores Qlik

## Escopo

Este inventário consolida evidências sanitizadas coletadas em 10 de agosto de 2026. As inspeções foram exclusivamente de leitura. Nenhum valor de credencial,
dado comercial ou dado pessoal de consumidor foi coletado para este documento.

## Caller confirmado

O publisher ativo é o workflow n8n `r4DyPyOTDtoROXq0`, chamado
`ranking imobs`. No instante observado, ele estava ativo e não arquivado, com a
versão ativa `969edbee-d8ca-4a13-a91b-24bd7decbe59` e agenda de 30 minutos.
Somente esse workflow, entre os 484 examinados, referenciava simultaneamente o
projeto CRM e a RPC legada de publicação.

O fluxo confirmado é:

1. o gatilho inicia uma execução a cada 30 minutos;
2. o workflow solicita um snapshot ao serviço Qlik de origem;
3. um node de código normaliza o envelope completo;
4. um HTTP Request publica o envelope na RPC legada do Supabase.

O node de publicação não referencia uma credential protegida do n8n. A
autenticação do node está configurada como `none` e os headers de publicação e o
verificador do contrato foram persistidos como literais. A identidade contida
nesses headers foi classificada como papel `anon`. Valores não foram copiados,
impressos, versionados ou incluídos nesta evidência.

## Correlação de execução

A amostra retida continha 28 execuções do workflow: 27 concluídas com sucesso e
uma com erro. As 27 execuções bem-sucedidas correlacionaram individualmente com
27 runs remotos `succeeded`, com diferença de 154 a 352 milissegundos entre o
fim registrado pelo n8n e a criação do run. Não houve execução bem-sucedida sem
run correspondente. A execução com erro não criou run, preservando falha
fechada.

Essa correlação, combinada ao identificador do user-agent observado nos logs da
Data API, elimina a hipótese de que o publisher seja o frontend, o repositório
GitHub, o serviço Qlik isoladamente ou outro workflow n8n.

## Origem Qlik

`qlik-ranking-api.service` é o upstream do workflow. O serviço estava ativo e
habilitado, executado pelo usuário de sistema `root`, e expõe `POST /export` ao
workflow. Ele inicia `qlik-ranking-export.cjs`, que acessa a fonte Qlik e produz
JSON.

A inspeção do serviço e do exportador não encontrou cliente Supabase,
PostgreSQL, DDL ou referência às tabelas de ranking. Portanto esse componente é
fonte do snapshot, mas não é o caller do Supabase. `root` identifica apenas o
owner técnico do processo no sistema operacional; não prova responsabilidade
humana ou comercial.

## Ownership

Os metadados do n8n atribuem o workflow a Leandro Lucas, com papel
`global:owner`, dentro de projeto pessoal. O mesmo ator aparece no histórico de
ativação observado. Essa é a identificação técnica confirmada do owner da
automação.

Nenhum owner alternativo, compartilhado ou backup foi encontrado. Antes do
cutover, o owner operacional e um backup responsável devem aceitar formalmente
o runbook, a rotação de credenciais, a janela de canário e o procedimento de
rollback. A associação não deve ser inferida a partir de `root`, nomes de
payload, rótulos Qlik ou ownership SQL.

## Consumidores

### Confirmados

- o workflow n8n é o único publisher confirmado da RPC legada;
- o Supabase persiste runs, entries e developments produzidos por esse
  workflow;
- a página de produção do Canal de Parcerias permanece protegida, mas não lê
  fatos Qlik e usa coleções vazias explícitas;
- a página shadow usa somente o read model v3 e permanece desligada por feature
  flag.

### Não atribuído

Os logs da Data API também registraram leituras `GET` das três tabelas Qlik sem
user-agent atribuível. Nenhum workflow ativo ou caller no repositório
correspondeu a essas leituras. Elas não devem ser classificadas como consumidor
de negócio, auditoria ou integração até existir correlação por request ID,
origem sanitizada e janela de execução.

## Exposição residual e tratamento

Os literais de publicação permanecem em uma linha do workflow, uma revisão do
histórico e 29 snapshots de execução retidos. A retirada segura exige, nesta
ordem:

1. manter o relay e suas flags desligados durante desenvolvimento;
2. validar nova credencial M2M de menor privilégio no canário;
3. trocar somente o workflow confirmado após aprovação;
4. observar duas janelas completas e reconciliar runs, contagens e hashes;
5. rotacionar os literais antigos;
6. aplicar a política aprovada de limpeza do histórico e dos backups do n8n;
7. somente então autorizar o hardening destrutivo separado.

Revogar o caminho anônimo ou rotacionar seus literais antes do relay validado
interromperia uma carga ativa. Restaurar grants diretos, reutilizar o verificador
antigo ou distribuir `service_role` não são opções de rollback.

## Estado do bloqueio

A identidade técnica do caller foi resolvida. Permanecem como gates:

- nomeação formal do owner operacional e backup;
- atribuição ou exclusão comprovada dos leitores `GET` sem identidade;
- relay autenticado, canário e observabilidade aprovados;
- rotação e limpeza verificadas sem revelar os valores anteriores.
