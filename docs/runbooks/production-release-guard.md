# Publicação com consulta ao vivo e trava compartilhada

Regra solicitada em 12/10/2026: antes de cada publicação, consultar a versão
ativa e a data real da última publicação no próprio minuto da troca. O CRM
tem mais de um desenvolvedor; uma consulta anterior aos testes não atende.

## Fluxo único

`pnpm release:production` coordena consulta, CAS de `IMAGE_TAG`, Compose e
health. A CI executa `pnpm test:release` dentro de `pnpm test`, incluindo testes
reais de `flock` e morte de processos no Linux. A CI existente continua gerando
o artefato imutável; este comando é a etapa protegida de promoção na VPS.
Este trabalho não cria credenciais SSH, runners ou deploy automático no GitHub.

O comando exige Linux, root e o checkout limpo do SHA candidato. Todos os
publicadores devem usar esta versão do comando no mesmo host. O coordenador
adquire, em ordem fixa, as três travas encontradas nos fluxos existentes:
`/etc/descomplica-crm/.production-deploy.lock`,
`/etc/descomplica-crm/.production-release.lock` e
`/etc/descomplica-crm/.production-image-binding.lock`. Mantém as três durante
toda a operação, inclusive verificação e recuperação. Outra tentativa falha imediatamente e
deve recomeçar depois, com estado atualizado; não há cancelamento do dono.
Os três descritores são herdados pelo processo Docker. Não apagar arquivos de
lock nem envolver o coordenador em outro `flock` sobre esses caminhos; ele
próprio realiza a aquisição, sem marcadores que dispensem o bloqueio.

O registro `/etc/descomplica-crm/production-release.json` é privado,
`root:root 0600`, escrito por rename atômico e fsync. Seu `release` contém
deployment ID único, SHA, image ID, `deployedAt` UTC e referência de evidência.
`inProgress` é persistido antes da primeira alteração. Uma interrupção mantém
essa pendência e bloqueia novas promoções, mesmo depois de o kernel liberar a
trava. O deployment ID detecta também o retorno A → B → A ao mesmo SHA.

Antes da troca, o coordenador verifica:

1. Registro, `production.env`, imagem do container e health local/público
   concordam com o deployment ID, SHA e image ID esperados.
2. `main` remoto corresponde ao candidato; a execução **concluída** de
   `.github/workflows/ci.yml` é `push/main` no SHA exato e todos os jobs foram
   aprovados, incluindo `validate`, `release-gates`, `isolated-restore` e
   `promotable-image`. A consulta usa a API GitHub; indisponibilidade ou rate
   limit bloqueia, sem usar cache como fallback.
3. A observação final, incluindo a segunda consulta à CI/main, está no mesmo
   minuto UTC da escrita e do início do Compose, com idade máxima de 60 s.
   O relógio não pode retroceder. Espera ou virada de minuto exige nova
   tentativa; se já houver intenção persistida, recuperar primeiro.
4. CAS do registro e da única linha `IMAGE_TAG` ainda coincide. O candidato
   já ativo com o mesmo image ID retorna `noop`, sem bind, Compose ou novo
   horário. Mesmo SHA com image ID diferente é divergência e bloqueia.

O health público recebe nonce, `no-cache/no-store` e timeout. A data de commit,
o fim da CI e a criação/reinício do container nunca viram `deployedAt`.
Nos novos deploys, esse campo registra a conclusão verificada da publicação,
depois que versão/imagem e ambos os health confirmam o candidato.

## Primeira adoção em uma produção já existente

Sem histórico confiável, a promoção fica bloqueada. Reunir evidência real da
última publicação, ligada ao SHA/imagem ativos, e preparar fora do Git um
arquivo JSON privado `root:root 0600`, em diretório root protegido, com:

```json
{
  "deploymentId": "12345678-1234-4234-8234-123456789abc",
  "sha": "SHA_ATIVO_EXATO_DE_40_CARACTERES",
  "imageId": "sha256:DIGEST_ATIVO_EXATO_DE_64_CARACTERES",
  "deployedAt": "DATA_REAL_UTC_NO_FORMATO_ISO_COM_MILISSEGUNDOS",
  "evidence": "Referência verificável ao registro da publicação concluída"
}
```

Os valores acima são marcadores, não evidência. Usar um UUID novo para a
importação e uma data proveniente do evento real de publicação. O operador
responde pela autenticidade da evidência histórica: o programa valida formato,
data não futura e correspondência com runtime, mas não prova sozinho a origem
do documento. Não inferir horário se essa evidência não existir.

```bash
sudo pnpm release:production initialize --attestation /caminho/privado/release-atual.json
sudo pnpm release:production status
```

`initialize` cria somente um registro ausente, nunca sobrescreve o existente,
e não inicia containers. `status` mostra o registro e eventual ID pendente;
não substitui a consulta ao vivo executada por `deploy` dentro da trava.

## Publicar

Concluir autorização aplicável, gates, backup e prova do artefato conforme
[PROMOTABLE_IMAGE_RUNTIME](../release-candidate/PROMOTABLE_IMAGE_RUNTIME.md).
Conservar a saída de `status` como evidência anterior. Usar os identificadores
esperados, não descobrir automaticamente uma nova baseline após conflito.

```bash
sudo pnpm release:production deploy \
  --expected-deployment-id "$production_deployment_id" \
  --expected-sha "$production_current_sha" \
  --sha "$release_sha" \
  --image-id "$homologated_image_id" \
  --ci-run-id "$main_ci_run_id"
```

O comando consulta tudo novamente; as variáveis de expectativa não são uma
evidência de frescor. Guardar saída sanitizada, SHA anterior/novo, horário UTC
e equivalente America/Sao_Paulo, fonte, decisão e smoke da jornada afetada.
Não logar `.env`, secrets ou saída completa de `docker inspect`.

### Conectar Salesforce, n8n e Supabase

Para a primeira conexao autorizada, acrescentar `--salesforce-ingestion enable`
ao comando `deploy` acima. A opcao exige um **novo SHA aprovado**; o SHA ja
ativo e recusado para configuracao, sem transformar `noop` em reinicio.
Nenhuma credencial pode ser passada na linha de comando.

O host le somente os arquivos privados existentes:

- `/etc/descomplica-crm/secrets/salesforce-supabase-secret`;
- `/etc/descomplica-crm/secrets/salesforce-crm-ingest-bearer`.

Depois da consulta final a CI e antes da intencao, prepara um backup privado
duravel do env completo anterior e proposto, com hashes, em
`/etc/descomplica-crm/config-backups/<deployment-id>.json`. O registro publico
do procedimento contem somente UUID e hashes, nunca os valores. Esses backups
contem segredos: nao versionar, publicar nem copiar para evidencias abertas.

A troca usa CAS do **env completo**, preserva as demais configuracoes e aplica
`SUPABASE_SECRET_KEY`, `SALESFORCE_INGEST_SECRET`,
`SALESFORCE_INGEST_ENABLED=true` e `SALESFORCE_REFRESH_ENABLED=false`, junto
com a imagem candidata. Duplicatas, arquivos inseguros, backup adulterado ou
alteracao concorrente bloqueiam. As tres travas e o limite de frescor continuam
obrigatorios. A confirmacao verifica tambem os quatro valores efetivos no
container, sem imprimi-los; health aprovado sozinho nao confirma configuracao.

Esta opcao nao publica workflows, agenda coletas, altera o banco ou aplica
migrations. A primeira carga e seu replay seguem o
[runbook Salesforce](salesforce-n8n-migration.md). Preservar o backup enquanto
existir tentativa pendente; a recuperacao usa seu conteudo, sem depender da
presenca posterior dos dois arquivos de credencial.

### Conectar o ranking Qlik v2

Para a ativacao autorizada, `deploy --qlik-ranking enable` utiliza um novo SHA
validado e a chave exclusiva em
`/etc/descomplica-crm/secrets/qlik-ranking-hmac`. O arquivo deve ser regular,
privado e root-owned. Nunca passar seu valor na linha de comando.

A opcao preserva a configuracao Supabase ja existente e todas as chaves
Salesforce. Somente IMAGE_TAG, QLIK_RANKING_V2_ENABLED e
QLIK_RANKING_V2_HMAC_SECRET mudam, sob as mesmas travas, frescor e CAS integral.
Backup privado schemaVersion2/kind qlik-ranking-v2 registra antes/depois;
recuperacao verifica esse contrato e os hashes dos valores efetivos. Backups
Salesforce schemaVersion1 continuam compativeis. As ativacoes de integracoes nao podem
ser solicitadas juntas. Vazio/ausente da flag Qlik equivale ao default false
do Compose, sem relaxar a exigencia das flags Salesforce.

Esta opcao nao aplica migration, nao modifica o owner Qlik nem habilita coleta.
Validacoes e etapas separadas em [ranking Qlik v2](qlik-ranking-v2.md).

### Conectar a sessão do Meta Ads

Para a ativação autorizada, acrescentar `--meta-ads enable` ao comando `deploy`.
A opção exige um novo SHA com CI aprovada e não pode ser combinada com
`--salesforce-ingestion` ou `--qlik-ranking`. Não editar `production.env`
manualmente, não passar credenciais na linha de comando e não reutilizar
segredos Salesforce, Supabase ou Qlik.

O coordenador lê exclusivamente estes arquivos regulares, privados,
`root:root 0600`, no diretório de segredos protegido:

- `/etc/descomplica-crm/secrets/meta-ads-status-bearer`: 32 a 256 caracteres
  ASCII seguros; o instalador gera 96 caracteres hexadecimais;
- `/etc/descomplica-crm/secrets/meta-ads-console-password`: exatamente oito
  caracteres ASCII seguros, incluindo `+` e `/`, compatíveis com a senha
  gerada pelo instalador. O console permanece atrás da autenticação do CRM.

A leitura aceita somente uma quebra de linha terminal opcional. Espaços,
controles, interpolação de shell/dotenv e arquivos inseguros bloqueiam a
preparação. Os valores nunca aparecem em argumentos Docker ou saída do
coordenador.

Sob as três travas, a consulta final e o CAS integral já descritos, a mudança
altera somente `IMAGE_TAG`, `META_ADS_STATUS_ENABLED=true`,
`META_ADS_STATUS_SECRET`, `META_ADS_CONSOLE_ENABLED=true` e
`META_ADS_CONSOLE_PASSWORD`. Todas as demais configurações permanecem intactas,
inclusive Salesforce e Qlik. Antes de persistir a intenção, o coordenador
salva o ambiente anterior e proposto no backup privado schemaVersion 2,
`kind: meta-ads-session`; o ledger recebe somente seu identificador e hashes.
A verificação compara os quatro valores efetivos do Meta Ads no container por
hash, além da configuração Salesforce preservada. Ausência ou valor vazio das
flags Meta Ads corresponde ao padrão `false` do Compose, permitindo recuperar
a imagem anterior, que ainda não conhece a integração.

A recuperação restaura exatamente o backup anterior, inclusive após remoção
dos dois arquivos de segredos de origem. Divergência no conteúdo integral do
env, backup adulterado ou valores diferentes no container bloqueiam conclusão.
Backups Salesforce schemaVersion 1 e Qlik schemaVersion 2 continuam compatíveis.

Esta opção ativa apenas o status e o console da sessão. Instalação da unidade
Meta Ads, login humano, validação da conta e uma futura coleta de campanhas
são etapas separadas; o deploy não comprova sessão autenticada nem extração de
dados. Consultar o [runbook Meta Ads](meta-ads-vps-session.md).

## Falha e recuperação

### Owner Qlik separado

O mesmo coordenador expoe `qlik-status`, `qlik-deploy` e `qlik-recover` para a
unidade dedicada Qlik. Nao muda imagem/env/ledger do CRM nem executa Compose;
mantem as tres travas, CI completa no main exato, imagem homologada, consulta
ao CRM no minuto da mutacao, CAS, backup e intencao duravel separada. Pendencia
Qlik bloqueia novas mutacoes CRM. Nao ha atualizador paralelo ou argumento de
unit/perfil arbitrario. Procedimento, limites e recuperacao em
[sessao Qlik](qlik-vps-session.md#atualizacao-protegida-do-owner). Este suporte
nao habilita coleta de fatos, banco ou agenda e nao confirma conexao Qlik.

Sem conclusão verificada, a pendência permanece. Manter o checkout limpo do
SHA que tentou publicar e a imagem anterior disponível. Consultar `status` e
executar a recuperação da **mesma** tentativa:

```bash
sudo pnpm release:production status
sudo pnpm release:production recover --deployment-id "$pending_deployment_id"
```

A recuperação usa as mesmas travas e aceita somente o ambiente/container da
tentativa ou da versão anterior registrada; divergência externa bloqueia. Ela
restaura por CAS a imagem anterior, verifica ambos os health e só então limpa
a pendência. Se o container anterior continuou executando desde a tentativa
inicial, verifica sua saúde
e preserva deployment ID/data originais (`aborted`), inclusive diante de um
timeout HTTP transitório. Antes de restabelecer o runtime, persiste
`inProgress.operation: rollback` por CAS. Os campos `targetSha`/`targetImageId`
continuam identificando o candidato original; `release` identifica a versão
anterior a restaurar. O checkout exigido continua sendo o candidato original.

Ao retomar essa fase, mesmo que a imagem anterior já esteja executando, verifica
a saúde e grava novo deployment ID e horário da conclusão verificada
(`recovered`), sem repetir o Compose. Esse horário não é uma estimativa do
primeiro `up` interrompido. Assim, uma sequência A → B → A não reutiliza o
recibo de A após uma interrupção. Falha mantém a pendência e a fase persistida.

Não há `rollback` genérico capaz de publicar uma imagem sem CI. Depois de uma
release concluída, a correção/reversão segue PR, CI completa em `main` e nova
promoção protegida. Recuperação não altera banco nem os arquivos de origem dos
secrets. Quando a tentativa inclui configuracao Salesforce, restaura por CAS o
env completo anterior e verifica os valores efetivos no container. Alteracao
externa ou perda/adulteracao do backup bloqueia, mantendo a pendencia. Releases
sem essa opcao e registros antigos preservam o comportamento anterior.

## Limite operacional

Os comandos antigos `release:bind-production-image` e mutações diretas pelo
wrapper de produção falham; `config --quiet` e `ps` continuam disponíveis.
Homologação mantém seu procedimento próprio. Não usar cópias antigas dos
scripts nem Docker direto para contornar o coordenador. Um usuário root com
acesso irrestrito ao host ainda pode ignorar o protocolo; esta trava não é uma
restrição de privilégios do sistema operacional. A adoção por todos os
publicadores e a inicialização com evidência são requisitos de ativação.
