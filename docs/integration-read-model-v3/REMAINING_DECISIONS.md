# Decisões e bloqueios restantes

## P0 — impedem cutover

| Decisão/bloqueio                        | Evidência atual                                                                   | Autoridade necessária                     | Próxima ação segura                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------- |
| Processo e owner nominal do caller Qlik | atividade remota provada; identidade nominal ausente                              | operação Qlik/VPS/n8n                     | acesso read-only temporário a logs e configuração; observar duas janelas            |
| IDs oficiais nas atividades Salesforce  | contratos atuais carregam nomes de gestor, corretor, imobiliária e empreendimento | owner Salesforce/Analytics Reports        | adicionar IDs oficiais aos relatórios e contrato; nenhum match por nome             |
| Vínculo Salesforce ↔ Qlik               | não há chave comum confirmada                                                     | owners Salesforce e Qlik                  | aprovar ID mestre ou tabela de ponte owned e versionada                             |
| Mappings reais e owners                 | nenhuma correspondência de produção foi inventada                                 | data steward por domínio                  | cadastrar owner, evidência e revisão antes de verificar mapping                     |
| Aplicação do hardening Qlik             | caller atual usa caminho que seria removido                                       | segurança + operação                      | implementar relay e cutover antes da revogação final                                |
| Ordem da pilha PR #28 + v3              | `20260809144143` revoga o caller antes da ponte v3                                | owners PR #28, segurança e operação       | separar ponte aditiva e hardening destrutivo; não aplicar a pilha atual remotamente |
| Autoridade real por dataset             | catálogo privado existe, mas nenhuma tupla de produção foi seedada                | owner da fonte + segurança + data steward | aprovar owner, tupla exata, evidência e cobertura em migration própria              |

## P1 — necessários antes de ampliar usuários

| Decisão                                                       | Estado conservador atual                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Herança das quatro permissões `crm.read_model_v3.*` por papel | zero grants automáticos; definir em migration posterior compatível com rollback            |
| Cutover das páginas                                           | produção continua v2; v3 existe somente em rotas shadow ocultas pela flag server-side      |
| Semântica de múltiplos grants                                 | usuário escolhe um scope; sem união implícita                                              |
| Conteúdo oficial do manifesto de escopos                      | estrutura fail-closed pronta; produtor/data steward deve certificar cada escopo            |
| Carteira versus organização em fatos sobrepostos              | produtor deve enviar portfolio oficial; sem derivação silenciosa                           |
| Ranking básico/avançado                                       | somente fatos/contagens; pesos, bônus, roleta e prêmios bloqueados                         |
| Metas e ritmo esperado                                        | indisponíveis até regra e versão oficial por scope                                         |
| Média anual/três meses                                        | somente competências explicitamente fechadas; definição comercial final pendente           |
| Política de staleness                                         | produtor declara `stale`; nenhum limiar foi inventado                                      |
| Retenção de runs e fila                                       | preservação indefinida nesta etapa; política formal pendente                               |
| Revogação recursiva operacional                               | leitura v3 falha fechada pela cadeia; workflow de cascade auditado ainda deve ser aprovado |
| Estoque                                                       | dataset existe no catálogo, fonte oficial ausente                                          |

## Divergências técnicas conhecidas

- O Qlik legado continua usando paginação por `OFFSET`; v3 deve usar contrato/paginação próprios quando fatos de parceria forem definidos.
- O contrato histórico Salesforce v2 aceita replay de mesmo request com conteúdo diferente; o v3 corrige isso, mas v2 não foi alterado nesta etapa.
- O runtime atual pode manter credencial privilegiada presente mesmo com ingestão Salesforce desativada; remoção/rotação exige etapa operacional autorizada.
- O limite Nginx versionado e o limite do contrato Qlik ainda divergem.
- O workflow n8n candidato Salesforce está inativo e não prova provenance “via n8n”.
- Grants históricos não-Master sem pai comprovável ficam `requires_reconciliation`; não se inventa ancestry.
- A secret key do Supabase possui blast radius global e alcança três RPCs de ingestão; o caller atual usar uma única RPC não reduz a capacidade da credencial.
- As rotas shadow e URLs v3 não são compatíveis automaticamente com bookmarks v2; redirect/cutover de URL permanece decisão separada.

## Decisões comerciais explicitamente não tomadas

- fórmulas dos simuladores WF13, WF14, WF15, WF16 e CAIXA;
- regra de ranking e desempate;
- pesos, bônus, roleta e prêmios;
- campanhas e metas definitivas;
- fórmula de planejamento/ritmo de vendas;
- regra de estoque, preço ou disponibilidade.

Essas lacunas aparecem como `indisponível`, `null`, `blocked` ou run rejeitado. Nenhum número é apresentado como real sem fonte oficial.
