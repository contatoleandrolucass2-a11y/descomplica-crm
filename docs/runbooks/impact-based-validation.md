---
id: DEPLOY-002
tipo: regra
status: vigente
criada_em: 2026-10-27
fuso: America/Sao_Paulo
origem: pedido direto do usuário em 27/10/2026
tags:
  - descomplica-crm
  - regras
  - deploy
  - validacao
---

# DEPLOY-002 — Validação por impacto e deploy sem retrabalho

[Instruções persistentes](../../AGENTS.md) · [Processo de publicação](automatic-publication.md) · [DEPLOY-001](production-release-guard.md)

## Objetivo e alcance

Antes de cada deploy, a validação deve se concentrar no módulo, tela, funcionalidade ou instância alterada e nas dependências que a mudança possa afetar. Não é necessário revisar novamente todo o sistema para publicar uma alteração localizada.

Por determinação do usuário em 27/10/2026, esta regra vale para os próximos deploys do CRM e se aplica a todos os desenvolvedores, agentes e responsáveis pela publicação, independentemente de quem implementou a mudança. O objetivo é eliminar retrabalho e revisões desnecessárias, mantendo uma publicação segura e tão rápida quanto as validações pertinentes e os gates obrigatórios permitirem.

## Procedimento obrigatório

1. **Delimitar o impacto.** Conferir as diferenças entre a versão publicada e o candidato, identificando alterações, dependências compartilhadas e fluxos potencialmente afetados. Considerar todas as mudanças incluídas na publicação, inclusive as de outros desenvolvedores; não limitar a análise ao último commit ou à própria tarefa.
2. **Validar o necessário.** Testar o comportamento alterado, seus critérios de aceite e os fluxos diretamente ou indiretamente afetados. Incluir permissões, cálculos, integrações e persistência quando fizerem parte desse impacto.
3. **Reaproveitar evidências válidas.** Não repetir testes ou revisões já aprovados para o mesmo candidato e condições relevantes, salvo alteração posterior que invalide a evidência, falha, divergência ou exigência do pipeline. Evidências de outra versão não comprovam automaticamente o candidato atual. Integração de mudanças concorrentes exige reavaliar o impacto e cumprir os gates do SHA resultante.
4. **Ampliar somente com justificativa.** Uma revisão mais abrangente exige motivo concreto, como mudança em componente compartilhado, autenticação, banco, infraestrutura ou impacto ainda desconhecido. Mesmo nesses casos, ampliar a validação conforme o alcance identificado; não presumir que todo o sistema precisa ser revisado. Registrar brevemente o motivo e o escopo adicional.
5. **Preservar as proteções obrigatórias.** Esta regra não dispensa os gates exigidos pelo pipeline, a autorização de publicação, o artefato aprovado, backup, rollback ou a DEPLOY-001: consulta atual da produção, data real do último deploy, trava compartilhada e comparação atômica da versão esperada. Não autoriza desabilitar gates, reduzir critérios de aprovação ou alterar o pipeline. Falhas obrigatórias fora do escopo devem ser encaminhadas ao responsável e reconciliadas; não podem ser ignoradas para publicar.
6. **Confirmar após publicar.** Verificar a versão efetivamente publicada, a saúde do serviço e o funcionamento dos fluxos afetados. Quando houver gravação, confirmar também a persistência.

## Critério de conclusão e registro mínimo

A entrega está concluída quando o impacto estiver delimitado, as validações pertinentes estiverem aprovadas, os gates obrigatórios estiverem concluídos e o funcionamento estiver confirmado após o deploy. Cumpridos esses requisitos, concluir a entrega sem acrescentar revisões redundantes.

Registrar no PR ou na evidência da entrega: versão publicada usada como base, SHA e artefato candidatos, áreas afetadas, validações executadas ou reaproveitadas e respectivas evidências, justificativa de eventual ampliação e resultado dos testes após a publicação. Referenciar os resultados existentes, sem duplicar relatórios ou executar novamente verificações válidas apenas para produzir outro registro.

## Distribuição e adoção

Esta regra é compartilhada pelo AGENTS.md, por este procedimento e pelas
orientações de validação e conhecimento do repositório. Aplica-se a todos os
desenvolvedores, agentes e publicadores, em qualquer host ou worktree. Antes
de preparar uma nova entrega, atualizar a base de instruções a partir da main
e incluir a DEPLOY-002 nos repasses de trabalho. Checkouts antigos devem
incorporar a regra; a integração documental não comprova que cada pessoa já
atualizou seu ambiente ou leu as instruções.

A análise de impacto não amplia a autorização de edição do chat. Falhas de
outras áreas devem ser registradas e tratadas no escopo responsável, conforme
AGENTS.md, sem correção incidental ou alteração de baseline para liberar a
entrega atual.

Mudanças exclusivamente documentais são integradas no Git e no conhecimento
curado; não exigem reinício ou deploy da aplicação sem mudança de runtime.
Para essas mudanças, conferir conteúdo, links, formatação e coerência das
instruções afetadas. A CI configurada continua executando seus checks
obrigatórios; seus resultados devem ser registrados sem duplicação local
injustificada. Esta regra não modifica workflows ou políticas de proteção.

Fonte normativa: pedido direto do usuário em 27/10/2026 para criar e salvar a
regra no conhecimento local, seguido de autorização explícita para integrá-la
no repositório compartilhado e aplicá-la aos próximos deploys de todos os
desenvolvedores. As exigências de consulta concorrente da DEPLOY-001 permanecem
íntegras.

## Release isolada autorizada em 27/10/2026

O usuário autorizou explicitamente uma release isolada do Tabelão sobre a versão
publicada, incluindo a adaptação do pipeline e do coordenador, sem dispensa dos
quatro jobs obrigatórios. Esta autorização permite o fluxo descrito em
[Publicação protegida](production-release-guard.md), com branch explícita
`codex/release-*`, SHA remoto exato, ancestralidade da produção, imagem imutável,
travas compartilhadas, CAS, backup e rollback. Não autoriza ignorar falhas nem
transportar funcionalidades alheias para o candidato isolado.

O desenvolvedor que concluir uma entrega posterior deve consultar a produção
vigente, incorporar a release publicada à sua base e validar o candidato
resultante. Não substituir o estado publicado por uma branch antiga. `main`
permanece a referência padrão; a seleção de uma branch isolada é explícita.
