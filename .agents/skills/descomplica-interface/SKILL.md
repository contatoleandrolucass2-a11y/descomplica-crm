---
name: descomplica-interface
description: Construir ou revisar telas, navegacao, formularios, temas e acessibilidade do DESCOMPLICA-CRM. Usar em mudancas de frontend; nao em operacoes exclusivamente de banco ou infraestrutura.
---

# Interface do CRM

- Leia AGENTS.md, docs/knowledge/CONTEXTO.md e FERRAMENTAS.md. Identifique rota,
  perfil autorizado e tarefa. Consulte knowledge:search com o assunto.
- Inspecione app/globals.css, app/(protected)/layout.tsx, componentes locais e
  lib/navigation. Os tokens reais prevalecem sobre referencias antigas de marca.
- Reutilize o sistema existente; nao troque framework, paleta ou estrutura de
  uma tela sem necessidade. Preserve conteudo integral dos simuladores legados.
- Para UX use descomplica-ux-audit se disponivel; para React/Next use
  vercel-react-best-practices e guias locais da versao instalada.
- Figma so quando houver arquivo/design relevante. Sem Figma conectado,
  componentes e referencias versionadas continuam sendo a base.
- Confira carga, vazio, indisponibilidade, erro recuperavel, teclado, foco,
  nomes acessiveis, toque, zoom e os tres temas. Nao mascare dados ausentes com zero.
- Use o navegador ativo via computer-use; suites do projeto usam Playwright.
  Nao capture identidades ou propostas reais em artefatos versionados.
- Criterios e comandos: .agents/skills/descomplica-validacao/SKILL.md.
  Diferencie inspecao DOM, screenshot e fluxo funcional realmente executado.
