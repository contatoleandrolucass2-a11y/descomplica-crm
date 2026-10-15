# Integração do painel de usuários e presença para a VPS

## Pedido e candidato

O usuário solicitou publicar na VPS o painel aprovado localmente e apresentar
a presença online com ponto verde pulsante e offline com ponto vermelho.
A animação usa um ciclo suave de 1,6 segundo; a preferência por movimento
reduzido mantém o ponto verde estático. Indisponibilidade continua neutra.

A integração parte dos cinco commits locais até `dd0cd1c` e incorpora
`main` atualizado em `9ffc8a9824c3de9cfde6ef41567dc28f3f12585d`. O checkout de integração
é separado da prévia local para preservar o resultado já aprovado.

O pacote inclui o diretório Pessoas e as abas de acessos, marcação conforme
herança e exceções, motivo automático, acesso único aos simuladores,
controles independentes RIVA/DIRECIONAL, herança completa do Administrador
e presença recente. Mantém as melhorias posteriores de paginação no servidor,
limites de consulta, gestão/rotina, estoque Salesforce e publicação protegida.

## Estado observado antes da preparação

A consulta inicial, que não serve como consulta final de promoção, encontrou
o ledger de produção com SHA `6843ef1ca6ab1f4344c11cdd7491004fd4f9faa9`,
deployment ID `57c09296-d8d8-421b-bca7-c12d10b4d50e` e conclusão em
`2026-10-14T20:38:13.413Z` (17:38:13.413 em São Paulo), sem pendência.
O container ativo usa o checkout de release desse SHA e estava saudável.
A CI `38627677505` desse `main` estava concluída com sucesso; ela não valida
o novo candidato ainda em preparação.

O projeto Supabase de produção foi identificado a partir do ambiente ativo,
`hnncxuerlcsaahdxoswb`. A consulta somente de metadados encontrou 37 migrations,
sem `profiles.access_status`, escopos de reporting ou os helpers privados
da base completa local. O contrato compacto usa a política de perfis
própria conta ou `users.view`, com gate restritivo de MFA. As migrations novas
precisam validar ambos os contratos; aplicar toda a sequência histórica local
não é uma estratégia de integração.

## Compatibilidade e gates locais

O catálogo compacto tem 23 permissões existentes e recebe duas marcas, totalizando 25. A interface consulta os defaults reais por RPC e não oferece os seis módulos
presentes apenas na sequência completa de 31 permissões.

A fixture compacta usa DDL e helpers de autorização, sem dados reais de usuários,
e exerce 115 verificações de MFA, hierarquia, marcas, defaults, presença e diretório compacto. Seu
runner cria um PostgreSQL efêmero sem rede ou portas publicadas, monta o código
somente para leitura e remove apenas os próprios recursos. A espera por TCP
exclui o servidor Unix temporário de inicialização. Três execuções consecutivas
passaram após a correção dessa condição de corrida. O gate foi incluído na CI.

A sequência de preparação é: checkboxes/RPC de defaults, simuladores para os
papéis ativos, catálogo de marcas e presença. Essas quatro migrations não
atribuem RIVA/DIRECIONAL a usuários ou papéis. A migration de herança completa
do Administrador deve ocorrer somente depois da ativação do runtime compatível,
pois a versão anterior rejeita chaves novas no contexto de autorização.

Validação local concluída até este checkpoint:

- Formato, lint, tipos, build, inventário de 53 rotas, audit, Gitleaks e OSV passaram.
- A suíte passou com 2.991 testes Vitest e 841 testes Node. Os 102 skips somados
  são condicionais de ambiente ou opt-in; a CI Linux mantém os gates nativos.
- O ensaio completo de migração e backup/restauração passou com 54 migrations,
  30 arquivos pgTAP e 1.431 verificações em cada banco, preservando privilégios.
- A primeira suíte Node teve duas falhas intermitentes no teste de host Qlik;
  não foram reproduzidas em 64 repetições, testes focados ou na nova suíte completa.
  Nenhuma verificação de segurança do runtime foi relaxada.

## Retomada em 15/10/2026

A conferência da retomada confirmou o mesmo deployment ID, SHA e horário de
produção, sem pendência. O `main` avançou para `9ffc8a9`, com CI
`38753275427` concluída com sucesso; seus ajustes de Qlik e QA do dashboard
foram incorporados sem executar operações desses sistemas. Essa CI não
valida o candidato de usuários.

A ausência de `profiles.access_status` não pode ser interpretada como aprovação.
A RPC protegida `get_user_directory_contract()` reconhece os contratos compacto
ou completo pela estrutura e pelas políticas exatas. A paginação compacta usa
`SECURITY INVOKER`, as políticas existentes, consulta limitada a seis perfis e
contagens no servidor; perfis ativos com papel operacional são apresentados
conforme sua elegibilidade real. Contratos ausentes, parciais ou desconhecidos
continuam em revisão legada, sem controles de aprovação indisponíveis no banco.

O gate compacto atualizado passou em 115 verificações. O ensaio completo passou em
1.441 verificações na origem e no banco restaurado, incluindo a recusa de
políticas alteradas e contratos parciais, com privilégios preservados.
O ajuste posterior limita-se à presença compacta: um papel já atribuído
continua elegível quando deixa de aceitar novas atribuições, conforme o core;
as quatro verificações adicionais passaram no gate compacto.

A QA visual anterior encontrou uma corrida de foco no simulador Associativo e
falhas de navegação/estabilidade ainda em investigação. Nenhuma imagem de
referência foi promovida a partir dessa execução falha. Os gates e seus limites
permanecem obrigatórios antes da publicação.

## Validação e publicação

Os resultados finais dos gates, do backup aplicável e da promoção serão
registrados depois de sua execução. A promoção deve usar o coordenador
`pnpm release:production`, com as três travas compartilhadas, consulta ao vivo
no mesmo minuto, revisão aprovada, imagem imutável, CAS e verificação final.
Nenhuma consulta inicial ou compilação local comprova publicação.
