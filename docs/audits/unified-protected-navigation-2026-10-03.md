# Navegação protegida unificada

Data de referência: 2026-10-03
Branch: `codex/unified-protected-navigation`
Base: `8e158cc9d13beeff0087064df6d9b58d87790379`

## Resultado esperado

Todas as superfícies autenticadas usam o mesmo shell persistente, com marca,
navegação hierárquica, aparência e conta. Os cinco simuladores deixam de montar
um segundo cabeçalho dentro da sub-rota. URLs, conteúdo, dados, cálculos e abas
contextuais permanecem nos respectivos componentes.

## Contrato de autorização

- `app/(protected)/layout.tsx` continua chamando `enforceAuthorization()` antes
  de montar qualquer elemento do shell.
- O catálogo `app_pages` é consultado via cliente autenticado e filtrado pelas
  permissões efetivas antes de chegar ao componente cliente.
- Tabela Direta, Tabela Investidor, Tabelão e Documentação, liberados fora do
  catálogo produtivo de 17 páginas, só são anexados no servidor quando o pai
  `crm.simulation`, a permissão `crm.simulators.view` e o gate da rota convergem.
- CAIXA continua `releaseEnabled=false`. Seu item de apresentação não possui
  `path`, não renderiza âncora e não entra na ordem de tabulação.
- Administração aparece somente na área de conta e apenas com as páginas que o
  catálogo já devolveu como autorizadas.
- Proxy, guards server-side, APIs, grants e RLS não são substituídos pelo menu.

## Inventário protegido

| Área          | Rotas                                                        | Navegação                    |
| ------------- | ------------------------------------------------------------ | ---------------------------- |
| Dashboard     | `/app` e cinco etapas                                        | grupo autorizado             |
| Comercial     | `/app/ranking`, `/app/canal-de-parcerias`                    | links autorizados            |
| Configurações | raiz, metas, parcerias e pontos                              | grupo autorizado             |
| Simulação     | hub, Associativo, Direta, Investidor, Tabelão e Documentação | grupo autorizado             |
| CAIXA         | `/app/simulacao/caixa`                                       | bloqueada, sem link          |
| Administração | raiz, usuários e páginas                                     | conta, somente se autorizada |

Rotas de conta e autenticação, como `/conta/seguranca` e `/mfa`, não alteram a
contagem comercial. Rotas shadow de read model continuam fora da navegação.

## Mudanças de interface

- Uma única topbar sticky em todas as rotas protegidas, com superfície própria
  para Claro, Médio e Escuro e acentos cyan coerentes com cada tema.
- Dashboard e Configurações passam a expor seus filhos no mesmo padrão de
  disclosure usado por Simulação.
- Tema Claro, Médio e Escuro permanece acessível; persistência continua
  condicionada ao consentimento funcional.
- Conta usa um gatilho compacto e reúne identidade completa, papel, Segurança,
  Administração autorizada e logout no painel, sem disputar espaço com os itens
  principais.
- Menu móvel, Escape, foco restaurado, alvos de toque, zoom e movimento reduzido
  seguem o mesmo contrato em todo o sistema.

## Validação

O baseline do SHA-base aprovou lint, TypeScript, 1.478 testes Vitest (1 ignorado),
oito testes Node e build Next. A captura integrada limpa no SHA `54e09b` aprovou:

- 147/147 checks responsivos das 21 páginas liberadas em sete viewports;
- 84/84 checks de tema, 201/201 auditorias Axe e 201/201 comparações promovidas;
- 105/105 checks de zoom, teclado, foco, identidade longa e reduced motion;
- 40/40 combinações de navegação das quatro jornadas arquivadas;
- Associativo, Documentação, Tabela Direta, Tabela Investidor e Tabelão em suas
  validações funcionais específicas;
- CAIXA bloqueada no hub, sem link, e acesso direto preservado como `403`;
- exatamente 201 imagens manifestadas e presentes, sem baselines órfãs da CAIXA;
- truncamento da identidade longa comprovado nas 147 combinações responsivas;
- conta e fixtures QA efêmeras removidas ao final.

O gate não alterou banco, RLS, grants, dados, integrações ou políticas comerciais.
CI, PR e publicação seguem o runbook automático depois da revisão independente.
