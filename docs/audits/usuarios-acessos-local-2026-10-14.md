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
