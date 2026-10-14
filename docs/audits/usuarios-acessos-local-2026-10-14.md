# Usuários e acessos — validação local de 14/10/2026

## Escopo autorizado

Implementação exclusivamente local em `codex/usuarios-permissoes-locais`, a partir de
`04a3fd55397a1761a49c7e4144f19d45896e7419`. A aplicação usa o Supabase Docker
`descomplica-crm-local`, com API em `127.0.0.1:55321` e banco na porta 55322.
Os usuários e os dados de demonstração são sintéticos. Esta entrega não autoriza
nem comprova publicação em homologação ou produção.

## Comportamento implementado

- Os quadrados representam a permissão efetiva: padrão do papel com as exceções
  individuais aplicadas. A consulta protegida `get_user_role_permission_defaults`
  fornece a herança atual do banco, sem conceder leitura direta das tabelas.
- A troca de papel remove as exceções anteriores e aplica os novos padrões na
  mesma transação. Se hierarquia, escopo ou delegação impedirem a operação, tudo
  é revertido. A prévia mostra os acessos adicionados e removidos antes de salvar.
- Marcar e desmarcar permissões produz um único salvamento atômico, inclusive
  quando a mesma alteração contém concessões, negações e restauração de herança.
- Os formulários não solicitam motivo. O servidor fornece a descrição da ação,
  e as funções existentes continuam registrando autor, alvo, data e alterações.
- Um único controle, **Acessar simuladores**, reúne visualização e execução.
  Ambas as permissões fazem parte dos padrões dos sete papéis atuais.
- A execução oficial exige as duas permissões. Foram removidos os bloqueios
  exclusivos de Master, preservando autenticação, origem, limites, configuração
  do motor e fórmulas. Permissão concedida não ativa motores indisponíveis.
- As quatro permissões técnicas do read model v3 e **Visualizar auditoria** ficam
  ocultas na matriz e no resumo visual. A restauração pela matriz não altera
  exceções ocultas. Seus registros, funções e controles no banco permanecem.

## Herança atual por papel

“Base” significa visualizar navegação, dashboard e etapas. Simuladores significa
visualizar e executar, apresentados como um único controle.

| Papel                     | Nível | Padrões principais                                                                                                       |
| ------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------ |
| Master                    |   100 | Administração, todos os dashboards, etapas, ranking, parcerias, configurações, dados, simuladores e políticas comerciais |
| Administrador             |    80 | Administração, todos os dashboards, etapas, ranking, parcerias, configurações, dados e simuladores                       |
| Coordenador               |    60 | Base, dashboard com Canal Imob, parcerias e simuladores                                                                  |
| Gerente House             |    55 | Base, dashboard sem Canal Imob, ranking e simuladores                                                                    |
| Gerente Imob              |    54 | Base, dashboard com Canal Imob, parcerias e simuladores                                                                  |
| Corretor House            |    25 | Base, dashboard sem Canal Imob, ranking e simuladores                                                                    |
| Corretor Imob             |    24 | Base, dashboard com Canal Imob, parcerias e simuladores                                                                  |
| Pendente e papéis legados |     — | Nenhuma permissão herdada                                                                                                |

A herança vem do papel atribuído, não da soma dos níveis inferiores. Exceções
podem negar ou conceder acessos dentro das regras de delegação. A hierarquia
limita quem pode administrar quem, e os escopos continuam limitando os dados.
Contas pendentes, inativas, suspensas ou sem os requisitos de acesso não são
liberadas por receber um padrão de papel.

## Auditoria existente

Esta versão não possui página de histórico de auditoria. A tabela `audit_logs`
e o leitor protegido `lib/authorization/audit.ts` existem; a consulta depende
de `audit.view` e das políticas de escopo. Ocultar a opção não desliga o registro.

## Evidências de validação

- Lint e TypeScript passaram. A suíte completa passou com 2.299 testes Vitest
  e 83 testes Node; os nove testes opcionais já ignorados permanecem ignorados.
- Após os últimos ajustes visuais, os 75 testes focados passaram, assim como
  lint, TypeScript e o build final. O inventário manteve as mesmas 45 rotas.
- No navegador, concessão e negação foram salvas e persistiram após recarga.
  A troca de Gerente House para Gerente Imob removeu as exceções anteriores.
  Desmarcar o controle único criou duas negações; restaurar o padrão removeu ambas.
- Os testes de execução oficial cobrem os sete papéis, ausência de qualquer uma
  das permissões, autenticação, configuração desligada e origem da requisição.
- `pnpm audit --audit-level high` não encontrou vulnerabilidades conhecidas.
- A primeira suíte completa de banco encontrou colisões com fixtures persistidas
  da prévia. A validação isolada passou com 1.139 testes pgTAP na origem e outros
  1.139 na cópia restaurada. Lint do banco e verificações de segurança e desempenho
  passaram em ambos. Privilégios, proprietários e dados permaneceram equivalentes
  após backup e restauração, sem remover as fixtures da prévia.
- Evidências locais ficam em `.local-dev/users-*.log` e não são versionadas.
- A sincronização com Obsidian retornou `not-configured`; os aprendizados
  permanecem disponíveis nos documentos versionados de `docs/knowledge`.

As duas migrations locais estão fora da lista de publicação do comando de
upgrade de autenticação/MFA da homologação. O catálogo desse ambiente remoto
não foi alterado.

## Acesso individual a RIVA e DIRECIONAL

Pedido posterior do usuário: oferecer duas marcações independentes e ocultar
as unidades das marcas não autorizadas. Padrão confirmado explicitamente:
ambas desativadas; liberar por usuário. A migration
`20261014193926_local_inventory_brand_access.sql` adiciona duas permissões de
nível mínimo 10, sem associá-las a qualquer papel, incluindo Master.

| RIVA | DIRECIONAL | Unidades visíveis nos simuladores |
| --- | --- | --- |
| Desmarcada | Desmarcada | Nenhuma |
| Marcada | Desmarcada | Somente RIVA |
| Desmarcada | Marcada | Somente DIRECIONAL |
| Marcada | Marcada | Ambas |

O controle “Acessar simuladores” continua separado. Ter uma marca liberada
não substitui a permissão de abrir ou executar simuladores.

`permissions.manage` permite delegar essas duas marcas sem recebê-las para
consulta. A exceção é restrita às duas chaves e conserva os controles de
hierarquia, escopo e estado da conta. Master não recebe bypass de leitura
nem permissão de alterar a própria conta ou outro Master. Trocar o papel
ou usar seu padrão remove as liberações individuais das marcas.

As quatro interfaces consultam `/api/inventory` e/ou `/api/inventory/snapshot`.
Ambas filtram no servidor, a cada chamada, usando permissões efetivas atuais.
A marca vem exclusivamente de `businessUnit`, com normalização de caixa e
espaços externos. Valores desconhecidos não concedem acesso. Nenhuma marca
retorna estoque vazio antes de tocar a origem, arquivo ou cache. Contagens
são recalculadas; metadados extras da origem são omitidos.

O cache compartilha apenas a origem bruta dentro do servidor, nunca uma
resposta filtrada entre usuários. O snapshot completo continua validado por
SHA e 3.301 identificadores antes do filtro. Dados já recebidos em uma aba
não são recolhidos retroativamente; novas consultas aplicam a revogação.

Validação local desta etapa:

- Marcação e gravação de RIVA isolada e das duas marcas conferidas no navegador
  e no banco; depois restauradas para nenhuma marca na conta sintética.
- Doze consultas HTTP autenticadas às APIs verificaram nenhuma, RIVA,
  DIRECIONAL, ambas, revogação e Master sem bypass. O estoque sintético tinha
  1.650 unidades RIVA e 1.651 DIRECIONAL. Esses valores não representam estoque
  comercial. A conta temporária e sua linhagem de escopo foram removidas.
- Testes de rota cobrem cache aquecido, concorrência entre perfis, unidades
  desconhecidas, metadados e integridade integral antes de filtrar o snapshot.
- Testes pgTAP: 1.166 passaram na origem efêmera e 1.166 na restauração, com
  lint, segurança, desempenho e equivalência de privilégios e proprietários.
- Lint, TypeScript e build passaram; 2.316 testes Vitest e 83 testes Node
  passaram, com nove verificações opt-in não executadas. Evidências ignoradas
  pelo Git: `.local-dev/brand-*.log`, `brand-http-evidence.json` e
  `brand-db-rehearsal.json`.
- Fixtures de QA usam grants explícitos somente nos Masters sintéticos que
  precisam consultar estoque. O fluxo que reutiliza Master de homologação
  não concede marcas. Os contratos de teste foram alinhados aos simuladores
  herdados pelos sete papéis; a matriz extensa de navegador não foi executada.

A nova migration também está fora do upgrade remoto de autenticação/MFA.
A implementação e a aplicação da migration permanecem exclusivamente locais.
