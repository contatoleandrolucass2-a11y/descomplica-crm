# N8n exclusivo do CRM

## Limite desta etapa

Instancia nova, sem importar, modificar ou apagar o n8n anterior. A autorizacao
do usuario em 12/10/2026 inclui o novo nome n8n-crm.descomplicapro.com.br e HTTPS.
Nao inclui substituir a conexao MCP anterior, credenciais ou volumes existentes.
Workflows continuam exclusivamente por MCP, com validate_workflow_code antes
de update_workflow e releitura depois. MCP indisponivel bloqueia essa etapa;
nao usar REST, importacao CLI ou banco como contorno.

## Separacao

- Projeto Compose: descomplica-n8n-crm; diretorio /srv/descomplica-n8n.
- N8n, PostgreSQL e runner externo dedicados; sem banco ou volumes do CRM.
- Imagens oficiais fixadas por digest, n8n e runner na mesma versao.
- Porta 5678 somente em 127.0.0.1; banco e broker sem portas publicadas.
- Sem Docker socket, host networking, container privilegiado ou perfil Salesforce.
- Segredos aleatorios locais em arquivo root-only; nunca imprimir Compose expandido.
- Nao usar docker system prune, volume prune, down -v ou comandos globais.

O preparador recusa recursos preexistentes. Falha parcial exige inspecao manual;
nao apagar o diretorio para conseguir repetir. A chave de criptografia precisa
ser preservada junto com o banco para recuperar credenciais no futuro.

## Acesso inicial

Manter privado ate o operador criar a conta proprietaria. Usar um tunel SSH
com bind local, sem escutar na rede do computador:

```powershell
ssh -N -L 127.0.0.1:5678:127.0.0.1:5678 descomplica-crm-vps
```

Abrir http://localhost:5678. O operador preenche a senha diretamente na tela,
sem envia-la pelo chat. Nao desativar cookies seguros nem o cadastro de usuarios.
Depois, configurar DNS A somente de n8n-crm para a VPS, verificar resolucao,
emitir certificado e preparar um virtual host Nginx exclusivo. Nao expor a
tela inicial de cadastro sem proprietario na internet. Nao reutilizar cookies,
tokens, credenciais ou dados privados da instancia antiga.

## Validacao e recuperacao

Antes de iniciar: validar Compose com --quiet, recursos livres, digests,
limites e ausencia de nomes/volumes preexistentes. Conferir healthz e
healthz/readiness locais, versao, estado do runner e bind somente loopback.
Comparar health/versao do CRM e atividade do browser/monitor Salesforce antes
e depois. Nunca executar build ou suite pesada na VPS compartilhada.

Rollback inicial: parar somente os servicos do projeto descomplica-n8n-crm,
preservando volumes e .env. Nao remover dados automaticamente. Antes de qualquer
upgrade posterior, fazer pg_dump consistente do banco dedicado e copia privada
da chave/configuracao e do volume .n8n; conferir checksum e restaurar em ambiente
isolado. Backup local no mesmo disco nao protege contra perda da VPS. Definir
destino externo autorizado antes de carregar dados comerciais nesta instancia.

## Proxima etapa

Depois de conta, HTTPS e MCP validado, criar fluxos inativos exclusivos do CRM.
Nao ativar agenda antes de conciliar os sete relatórios e o recibo final da
publicacao. Seguir [contrato Salesforce](salesforce-n8n-migration.md). Conexao
Salesforce, instancia n8n instalada e Supabase atualizado sao estados distintos.

## Fontes

- [Instalacao oficial](https://docs.n8n.io/hosting/installation/docker/).
- [Runner externo](https://docs.n8n.io/hosting/configuration/task-runners/).
- [Release 2.42.7](https://github.com/n8n-io/n8n/releases/tag/n8n%402.42.7).
