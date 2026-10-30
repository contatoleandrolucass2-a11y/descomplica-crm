# Trabalho objetivo por demanda

Regra permanente solicitada em 29/10/2026. Escopo: Git comum do DESCOMPLICA-CRM,
seus worktrees e extensões versionadas. Complementa AGENTS.md e DEPLOY-002.

## Antes de executar

Identificar o resultado pedido, as páginas autorizadas e como comprovar o aceite.
Ler o contexto uma vez pelo `knowledge:context`, buscar somente o assunto e
conferir as fontes atuais pertinentes. Notas antigas não ampliam autorização.
Reusar contexto íntegro já disponível; ler novamente apenas fonte alterada ou
trecho ausente. Consultas triviais não exigem uma nota ou ciclo de publicação.

Cada ação precisa atender a uma destas razões: implementar o pedido; validar
seu comportamento ou dependência afetada; cumprir um gate obrigatório. Ausência
dessas razões significa não executar. Uma falha fora do escopo é reportada, não
corrigida incidentalmente. Uma auditoria abrangente precisa de pedido próprio.

## Validação e espera

Testes locais focados dão feedback durante o desenvolvimento. CI fornece os gates
completos do candidato; não duplicar automaticamente ambos. Evidências incluem
SHA, ambiente e resultado. Mudança de código, ambiente ou dependência relevante
invalida a evidência correspondente. Não usar sucesso de outro SHA como aprovação.

Preferir espera por evento ou processo que devolva apenas mudança relevante.
Quando consulta for necessária, espaçar conforme a duração observada e limitar
a resposta a estado, falha ou conclusão. Não carregar logs completos enquanto
o job está saudável. A duração de CI não equivale a tokens consumidos.

## Integração e encerramento

Chats podem implementar demandas independentes em worktrees distintos.
Publicadores coordenam uma integração por vez e mantêm DEPLOY-001, sem cancelar
processos alheios. Contexto longo pode ser transferido para novo chat com resumo
de escopo, SHA, PR, evidências e pendências, sem copiar a conversa inteira.

Preparar documentação junto da mudança e referenciar a evidência final existente.
Não criar nova release de aplicação só para registrar uma release anterior.
Uma nota de resultado não exige outra nota para documentar sua própria integração.
Se registro documental ainda aguarda CI, informar separadamente da aplicação
já publicada. Conhecimento sincronizado não é treinamento nem garantia de que
outro chat leu a instrução: agentes devem consultar a versão vigente.

## Limites da otimização

### CI documental autorizada em 29/10/2026

O pedido explícito de corrigir desperdícios neste processo autorizou uma faixa
rápida somente para pull requests cujo diff inteiro altere apenas WORKLOG.md,
CHANGELOG.md ou Markdown diretamente em docs/knowledge. Formatação e testes de
conhecimento, inventário e classificação continuam obrigatórios. Os jobs pesados
ficam explicitamente ignorados nesses PRs, sem fabricar resultados de execução.

AGENTS, skills, runbooks, scripts, workflows, dependências, código, arquivos
desconhecidos, symlinks e falhas de classificação exigem CI completa. Todos os
pushes em main permanecem completos, inclusive os documentais. Assim, o guard
de produção continua exigindo os quatro jobs aprovados no SHA exato; a faixa
rápida de PR não é prova de candidato publicável. Esta entrega altera o próprio
pipeline e por isso também exige CI completa.

A matriz visual por impacto usa um classificador versionado e fail-closed. Rotas
conhecidas podem executar cobertura focada; Meta Ads preserva seu QA dedicado sem
repetir a matriz autenticada; mudanças globais, desconhecidas ou inconclusivas
executam a matriz completa. A cobertura integral continua semanal e manual.
Compartilhar fixtures em paralelo permanece fora do escopo. Não foram alteradas
proteções de branch nem permissões externas do GitHub.

Preservar gates obrigatórios, acesso no servidor, RLS, segurança, artefato imutável,
backup, rollback, lock, CAS e health. Alterar o pipeline exige demanda explícita
e testes do classificador; caminhos desconhecidos devem cair na validação completa.
Plugins globais e outros projetos não são modificados por esta regra. Não desativar
extensões nem mudar confiança, contas ou permissões para economizar tempo.
