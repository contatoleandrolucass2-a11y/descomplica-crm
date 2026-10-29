---
name: descomplica-interface
description: Construir ou revisar telas, navegacao, formularios, temas e acessibilidade do DESCOMPLICA-CRM. Usar em mudancas de frontend; nao em operacoes exclusivamente de banco ou infraestrutura.
---

# Interface do CRM

- Reutilize AGENTS.md e o contexto já lido nesta conversa; knowledge:context
  entrega CONTEXTO.md e FERRAMENTAS.md sem exigir uma segunda leitura.
  Identifique rota, perfil autorizado e tarefa. Busque apenas o assunto pertinente.
- Inspecione primeiro os componentes da rota solicitada. Consulte globals.css,
  layout protegido e lib/navigation somente quando estilos, shell, navegação
  ou permissões fizerem parte do impacto. Os tokens reais prevalecem sobre
  referências antigas de marca.
- Reutilize o sistema existente; nao troque framework, paleta ou estrutura de
  uma tela sem necessidade. Preserve conteudo integral dos simuladores legados.
- Para mudanças de fluxo use descomplica-ux-audit se pertinente; para desempenho
  React/Next use vercel-react-best-practices. Consulte os guias locais da versão
  instalada quando usar APIs do framework. Não executar auditoria ampla por rotina.
- Figma so quando houver arquivo/design relevante. Sem Figma conectado,
  componentes e referencias versionadas continuam sendo a base.
- Confira carga, vazio, indisponibilidade, erro recuperavel, teclado, foco,
  nomes acessiveis, toque, zoom e os tres temas. Nao mascare dados ausentes com zero.
- Use o navegador ativo via computer-use; suites do projeto usam Playwright.
  Nao capture identidades ou propostas reais em artefatos versionados.
- Criterios e comandos: .agents/skills/descomplica-validacao/SKILL.md.
  Diferencie inspecao DOM, screenshot e fluxo funcional realmente executado.
