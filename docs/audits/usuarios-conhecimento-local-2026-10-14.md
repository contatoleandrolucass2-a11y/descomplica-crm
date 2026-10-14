# Conhecimento da preparação local de usuários

As seções abaixo foram preservadas integralmente durante a integração com `main`.
São registros da preparação local; não comprovam publicação na VPS.

## 2026-10-14: Presença recente dos usuários

- Fonte: pedido do usuário para identificar quem está online no sistema; implementação local em `20261014204014_local_user_presence.sql` e nas APIs `/api/presence` e `/api/admin/users/presence`.
- Online significa sinal recebido há menos de dois minutos de uma conta ativa, aprovada e com papel/escopo válido. O navegador envia o sinal a cada 30 segundos somente na aba visível. Fechar, ocultar, sair ou perder conexão encerra a renovação; a expiração não é instantânea. Outra aba visível pode manter a conta online.
- `private.user_presence` guarda uma linha por usuário com o último horário do servidor, sem histórico. `touch_user_presence()` não recebe identidade nem horário do cliente e limita gravações a uma por 20 segundos.
- `get_user_presence()` exige `users.view` e repete a política atual de `profiles`: a própria conta ou `private.can_manage_user`. Mudanças futuras na policy devem revisar esse contrato e seus testes de escopo.
- Consulta de presença não recarrega a rota, não concede permissões e não muda rascunhos. Falha ou resultado não renovado em 90 segundos aparece como indisponível, nunca como ausência confirmada.
- O estado online expira individualmente pelo restante da janela de dois minutos, usando a idade informada pelo servidor e a duração monotônica local. Ao retomar uma aba, verificar esse prazo antes da próxima resposta para não exibir um sinal antigo como presença atual.
- Estado administrativo Ativo/Revogado e presença Online/Offline são conceitos separados. O último login da autenticação não é fonte de presença.
- Evidências em `docs/audits/presenca-usuarios-local-2026-10-14.md`; não houve publicação remota.

## 2026-10-14: Referência visual do painel de usuários

- Fonte: duas imagens fornecidas pelo usuário para o formato do diretório e da matriz. Usar a estrutura visual, sem copiar identidades ou quantidades da referência.
- As categorias visíveis são Comercial (8), Simuladores (4), Configurações (5) e Administração (8), conforme o catálogo atual. Cinco permissões técnicas permanecem ocultas e visualizar/executar simuladores usam uma única caixa.
- A busca percorre todas as categorias, ativa uma categoria com resultado e preserva alterações ainda não salvas. Abas usam setas, Home e End; o painel recebe foco também quando todos os controles estão desabilitados.
- O contador de acessos representa o estado salvo. Contas inativas, pendentes e com papel inválido exibem zero acesso efetivo, sem alterar sua herança ou permissões persistidas.
- O filtro Revogados não inclui contas que apenas aguardam aprovação. A busca por papel permanece disponível no campo de pesquisa, substituindo a seleção separada de papel.
- Validação local registrada em `docs/audits/usuarios-acessos-local-2026-10-14.md`; nenhuma publicação remota foi realizada.

## 2026-10-14: Administrador passa a herdar todo o catálogo

- Fonte: pedido posterior do usuário, “Admin deve ter tudo herdado como padrão”. Substitui o padrão anterior de marcas desativadas somente para o Administrador; os outros papéis permanecem iguais.
- `20261014201400_local_admin_all_permission_defaults.sql` associa o Administrador a todas as 31 permissões atuais. A tela oferece 25 controles porque cinco permissões técnicas ficam ocultas e as duas de simuladores compartilham um controle.
- A alteração de defaults preserva negações individuais. Nível 80, escopo, bloqueios de autoalteração, pares e superiores e min_level de delegação não mudam. Herança não ativa motores desligados nem substitui gates explícitos Master-only.
- Papéis e escopos são verificados separadamente: uma conta com apenas escopo de equipe não pode receber Administrador, que requer escopo compatível. A prévia usa uma conta sintética de organização, mantendo a recusa da transição incompatível.
- Validação e limites em `docs/audits/usuarios-acessos-local-2026-10-14.md`. Nenhuma evidência desta nota comprova publicação remota.

## 2026-10-14: Marcas exigem liberação individual

- Fonte: pedido do usuário e resposta explícita “Ambos desativados; liberar por usuário”. Nenhum papel, inclusive Master, herda `crm.inventory.riva.view` ou `crm.inventory.direcional.view`.
- A gestão de permissões não concede leitura de estoque. O guard de delegação permite configurar somente essas duas chaves sem possuí-las, mantendo nível, escopo, estado da conta e bloqueio de autoelevação.
- Associativo, Investidor, Direta e Tabelão usam as duas APIs protegidas de estoque. A marca é identificada pelo campo `businessUnit`, com trim e normalização de caixa, aceitando somente Riva e Direcional. Não inferir marca pelo empreendimento.
- O cache pode compartilhar a origem bruta apenas no servidor; cada resposta deve filtrar novamente conforme as permissões atuais. Nenhuma marca significa estoque vazio sem consultar a fonte.
- Trocar papel ou restaurar padrões remove as liberações individuais dessas marcas. Dados já carregados em uma aba não são apagados retroativamente; novas consultas aplicam a revogação.
- Escopo local; esta nota não comprova publicação remota. Validação detalhada em `docs/audits/usuarios-acessos-local-2026-10-14.md`.

## 2026-10-14: Herança e controle de acesso na prévia local

- Fonte: solicitação do usuário, código do painel e banco Docker local.
  A tela deve consultar os padrões atuais do banco, pois a lista estática
  omitia uma permissão de políticas comerciais já concedida ao Master.
- Um controle visual pode representar duas permissões técnicas: simuladores
  requerem visualização e execução juntas. A execução verifica ambas; a
  mudança não pode se limitar a remover o bloqueio visual ou o papel fixo.
- Ocultar controles técnicos não significa revogar permissões ou remover
  registros. A auditoria continua automática, apesar de não haver tela de
  consulta nesta versão. Não restaurar silenciosamente exceções ocultas.
- A troca de papel com restauração de exceções exige uma única transação e
  a preservação dos bloqueios de hierarquia, escopo e delegação.
- Suites de banco que esperam ausência de dados devem rodar em projetos
  efêmeros; a base de demonstração contém fixtures persistidas.
- Evidências e matriz: `docs/audits/usuarios-acessos-local-2026-10-14.md`.
  Escopo exclusivamente local; esta nota não comprova deploy remoto.
