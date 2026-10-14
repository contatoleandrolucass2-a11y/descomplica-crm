# Integração do painel de usuários e presença para a VPS

## Pedido e candidato

O usuário solicitou publicar na VPS o painel aprovado localmente e apresentar
a presença online com ponto verde pulsante e offline com ponto vermelho.
A animação usa um ciclo suave de 1,6 segundo; a preferência por movimento
reduzido mantém o ponto verde estático. Indisponibilidade continua neutra.

A integração parte dos cinco commits locais até `dd0cd1c` e incorpora
`main` em `6843ef1ca6ab1f4344c11cdd7491004fd4f9faa9`. O checkout de integração
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

## Validação e publicação

Os resultados finais dos gates, do backup aplicável e da promoção serão
registrados depois de sua execução. A promoção deve usar o coordenador
`pnpm release:production`, com as três travas compartilhadas, consulta ao vivo
no mesmo minuto, revisão aprovada, imagem imutável, CAS e verificação final.
Nenhuma consulta inicial ou compilação local comprova publicação.
