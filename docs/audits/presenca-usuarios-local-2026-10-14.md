# Presença dos usuários — validação local de 14/10/2026

## Escopo e significado

A implementação parte de `879f1cd` na branch `codex/usuarios-permissoes-locais`.
Somente o checkout local e o Supabase Docker `descomplica-crm-local`, API 55321
e PostgreSQL 55322, foram utilizados. Contas de teste e dados são sintéticos.

Online representa um sinal recente da aplicação, não uma garantia de que a
pessoa esteja interagindo naquele instante. A aba visível envia o sinal a cada
30 segundos e o banco considera online um sinal mais recente que dois minutos.
Ocultar ou fechar a aba, sair da conta e perder a conexão interrompem a renovação.
Outra aba visível da mesma conta pode manter a presença. A situação administrativa
Ativo/Revogado permanece separada.

## Implementação e controles

- `UserPresenceHeartbeat` é montado somente no shell protegido. Usa a sessão
  atual, não envia corpo, não bloqueia a interface e encerra as tentativas quando
  a sessão recebe 401/403. Timers, listeners e requisições são limpos ao desmontar.
- `POST /api/presence` verifica autorização e origem. A RPC `touch_user_presence()`
  resolve identidade e horário no banco, com aprovação, papel, escopo e MFA.
- `private.user_presence` possui RLS, nenhuma permissão direta para os papéis
  da API e uma única linha por usuário. Não armazena navegação, IP ou histórico.
- `GET /api/admin/users/presence` exige `users.view`. A RPC reproduz a visibilidade
  atual de `profiles`: própria conta ou alvo permitido por `private.can_manage_user`.
  As respostas não são armazenadas em cache e não contêm e-mail ou dados de sessão.
- A interface consulta a cada 30 segundos e ao voltar ao foco/conexão. Falhas,
  dados inválidos e resultado sem renovação por 90 segundos ficam indisponíveis.
  Cada estado online também expira pelo tempo restante da janela de dois minutos,
  calculado com os horários do servidor e a duração monotônica no navegador.
  Um sinal de 119 segundos não continua online por mais 90 segundos.
  A consulta não usa `router.refresh`, portanto preserva rascunhos e seleção.
- A migration `20261014204014_local_user_presence.sql` foi aplicada somente ao
  banco local e registrada como não publicável no upgrade específico de autenticação.

## Verificações

- Dezesseis testes de API cobrem autenticação, MFA, origem, ausência de `users.view`,
  identidade forjada, dados inválidos e indisponibilidade sem diagnóstico privado.
- Dez testes do heartbeat cobrem visibilidade, timers, timeout, limpeza, falhas,
  parada após 401/403, múltiplas abas e ausência de efeitos durante SSR.
- Vinte e sete testes de consulta e interface cobrem respostas, expiração
  individual, relógio local divergente, retomada após suspensão dos timers,
  isolamento por IDs, indisponibilidade, abort e separação entre presença e
  estado da conta. A correção da expiração passou por revisão independente.
- Doze verificações HTTP reais passaram com uma conta sintética temporária:
  ausência de sinal, autenticação, origem, leitura não autorizada, heartbeat próprio,
  tentativa de informar outro usuário, expiração, retomada e suspensão imediata.
  A expiração foi induzida somente no último sinal da fixture, que foi removida
  depois do teste. Credenciais não foram registradas na evidência.
- No navegador local, a sessão aberta apareceu online e as outras contas sem
  sinal apareceram offline. O indicador indisponível foi observado antes da
  aplicação da migration, sem apresentar esse erro como usuário offline.
- A atualização automática preservou uma alteração de RIVA ainda não salva.
  Esse rascunho foi descartado ao concluir o teste, sem modificar acessos.
  Os três temas foram inspecionados, e a largura de 320 pixels apresentou
  indicadores legíveis, foco visível e nenhuma rolagem horizontal da página.
  A largura normal foi restaurada e uma captura local registrou o resultado.

## Validação completa

- `pnpm lint` e `pnpm typecheck` passaram.
- `pnpm build` concluiu a compilação e a geração de rotas com sucesso.
- `TMPDIR="$PWD/.local-dev/tmp" pnpm test` passou com 2.382 testes Vitest,
  nove testes opcionais ignorados e 83 testes Node. O diretório temporário real
  evita as falhas já conhecidas de testes de caminho seguro no alias `/var` do
  macOS; nenhum controle desses testes foi alterado para contornar a validação.
- O ensaio isolado validou 50 migrations e 1.212 testes pgTAP tanto na origem
  efêmera quanto no banco restaurado, além de lint e advisors de segurança e
  desempenho. Backup e restauração preservaram dados, proprietários e privilégios
  efetivos, com fingerprints iguais. Isso não representa restauração de produção.
- O teste de grants passou após incluir somente as duas novas RPCs na lista
  auditada. A fixture de revogação informa autor e motivo, conforme a restrição
  existente no banco. Todos os 37 testes específicos de presença passaram.
- `pnpm resources:check` confirmou 47 arquivos de rota inventariados.
- `git diff --cached --check` passou e o Gitleaks não identificou segredos no
  patch preparado para o commit.
- `pnpm knowledge:sync` retornou `not-configured`; os aprendizados estão em
  `docs/knowledge/ATUALIZACOES.md`. Nenhum vault externo foi conectado.

Evidências detalhadas ficam em `.local-dev/presence-*`, ignorado pelo Git.
