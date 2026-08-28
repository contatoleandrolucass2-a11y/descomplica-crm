# Matriz de RLS e onboarding

> Proposta histórica de hardening escopado do read model v3. Ela não descreve a
> baseline produtiva que o PR #49 deve preservar e não é aplicada por suas duas
> migrations candidatas. O estado observado está em
> [`../security/PRODUCTION_RBAC_COMPATIBILITY.md`](../security/PRODUCTION_RBAC_COMPATIBILITY.md).

## Princípios

- Nome, e-mail, texto de gerente ou nome de imobiliária nunca autoriza acesso.
- Escopo deriva de IDs estáveis e grants temporais auditados.
- Usuário novo nasce `pending`, inativo, com papel `pending` e zero permissões.
- Aprovação é uma transação única: papel, escopo, ativação e audit log.
- Nenhum fallback global é criado quando uma identidade externa não resolve.
- Read models comerciais v2 são globais; até existir v3 com
  `reporting_scope_id`, somente Master recebe suas permissões.
- Intake por Admin exige vínculo ativo e confiável entre Auth e
  `crm_people.auth_user_id`, dentro do escopo delegável. Nome/e-mail não basta.
- Somente Master ou Admin pode aprovar e reativar; overrides de
  `users.manage`/`roles.manage` não elevam um papel inferior a aprovador.
- Gerente, Corretor, Imobiliária e House exigem exatamente um scope ativo. A
  regra está no validador central, inclusive para troca posterior de papel.
- UI não substitui RLS, grants e RPCs `SECURITY DEFINER` validadas.

## Papéis e escopos compatíveis

| Papel              | Escopo proposto           | Estado neste incremento                                                                        |
| ------------------ | ------------------------- | ---------------------------------------------------------------------------------------------- |
| Master             | Global                    | Grant global explícito; único leitor dos fatos comerciais v2                                   |
| Admin              | Organização explícita     | Administração escopada; intake somente de pessoa ativa/confiável em `crm_people`; sem fatos v2 |
| Coordenador        | Carteira e/ou equipe      | Metadados limitados aos grants; sem fatos v2                                                   |
| Gerente            | Equipe                    | Papel técnico sem permissão comercial automática                                               |
| Corretor           | Pessoa                    | Somente própria pessoa/relacionamentos permitidos; sem fatos v2                                |
| Imobiliária        | Organização `real_estate` | Organização única compatível; sem fatos v2                                                     |
| House              | Organização `house`       | Organização única compatível; sem fatos v2                                                     |
| Canal de Parcerias | Carteira `partnership`    | Carteiras explícitas; sem fatos v2                                                             |
| Pendente           | Nenhum                    | Inativo e sem permissão                                                                        |

`supervisor`, `broker_lead` e `user` são preservados como papéis legados, mas
não podem ser escolhidos pela nova RPC de aprovação sem decisão de
reclassificação. Contas existentes não-Master migram para `legacy_review` e
falham fechadas até reconciliação.

Admin não recebe uma fila global de cadastros pendentes. Um alvo sem grant
anterior só pode entrar no intake escopado depois que fonte confiável criar uma
linha ativa em `crm_people`, ligar `auth_user_id` ao UUID Auth correto e situar a
pessoa numa equipe/organização que o Admin possa ler. Essa associação não pode
ser inferida por nome, e-mail ou texto de gerente.

## Protocolo de mudança de topologia

As identidades de `crm_reporting_scopes` e a organização de `crm_teams` não
podem ser alteradas em linha. Transferências criam novo objeto e passam por
reconciliação explícita. Mudanças em `crm_team_memberships`,
`crm_people.auth_user_id` ou `crm_portfolio_organizations` são bloqueadas quando
qualquer grant de pessoa/carteira atual ou futuro não expirado pertence a um
perfil aprovado e ativo.

O fluxo obrigatório é:

1. suspender o usuário pela RPC auditada;
2. alterar a topologia em uma operação controlada de owner/migration;
3. revalidar papel, identidade, cardinalidade e todos os limites direcionais;
4. reativar pela RPC. Admin só reativa se a nova fronteira continuar contida;
   Master é necessário para aceitar uma mudança de fronteira válida.

Advisory locks por pessoa/carteira e locks `FOR UPDATE` de perfis em ordem de
UUID serializam esse fluxo com aprovação e reativação. As RPCs repetem
`can_manage_user`, delegabilidade e compatibilidade após adquirir os locks.
Memberships não expiradas entram na contenção mesmo se forem futuras ou se a
equipe/organização estiver inativa, evitando expansão posterior por ativação.
`membership_role` é metadado e nunca concede autorização.

## Recursos

| Recurso                                | Enforcement preparado                                     | Limite atual                                            |
| -------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| Organizações/equipes/carteiras/pessoas | RLS + helpers por grant temporal                          | Estrutura inicialmente vazia                            |
| Perfil/papel/exceções                  | Próprio usuário ou gestor com escopo delegável            | UI de aprovação ainda não implementada                  |
| Auditoria                              | Master global ou linha com scope autorizado               | Eventos legados sem scope ficam invisíveis a não-Master |
| Qlik                                   | Sem SELECT direto; leitura RPC por identidade+organização | Sem mapeamento, resultado vazio                         |
| Configurações/metas                    | Master-only; sem filtro dimensional fictício              | Read model v2 global                                    |
| Dashboard/etapas/ranking               | Master-only; sem override comercial para não-Master       | Exige v3 antes de segmentação                           |
| Simulações salvas                      | Nenhuma tabela/engine liberado                            | Estado indisponível; futuro padrão será proprietário    |
| Dados comerciais                       | Negação para todo não-Master no v2                        | Escopo v3 ainda pendente                                |

## Casos testados

- signup pendente, perfil inativo, zero permissions/pages;
- Master com escopo global;
- isolamento organização A/B, equipe, carteira e pessoa;
- grants expirados;
- incompatibilidade papel/escopo;
- rejeição de papel unitário com múltiplos scopes compatíveis;
- bloqueio de mutação de pessoa, membership e carteira com usuário ativo;
- suspensão, mudança controlada, negação de reativação fora da fronteira e
  rejeição de pessoa sem membership ativa;
- afiliação futura/inativa fora do escopo negada antes da aprovação;
- v2 comercial visível somente ao Master;
- intake Admin negado sem `crm_people` confiável e permitido quando o vínculo
  pessoa/Auth está ativo e dentro do escopo;
- aprovação atômica e auditoria;
- acesso horizontal e vertical;
- negação `anon` e ausência de CRUD direto `service_role` no Qlik;
- funções browser/API com claims sintéticos por papel.

Os testes usam somente UUIDs, organizações e dados sintéticos dentro de
transações com rollback.

O hardening Qlik é convergente: preserva tabelas e linhas, mas remove
policies/grants diretos e a RPC legada após o cutover. Preservar dados
históricos não obriga preservar interfaces inseguras.
