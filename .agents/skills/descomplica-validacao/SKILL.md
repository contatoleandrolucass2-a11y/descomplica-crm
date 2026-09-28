---
name: descomplica-validacao
description: Validar alteracoes e preparar evidencias de PR ou release no DESCOMPLICA-CRM. Usar no fechamento de codigo, regressao, acessibilidade, seguranca de acesso e verificacao de CI.
---

# Validacao com evidencias

- Registre branch/SHA, escopo e criterios de aceite. Use Node 24.19.x e pnpm
  11.20.x. Rode lint, typecheck, test e build, conforme AGENTS.md.
- Tests unitarios nao substituem navegador nem pgTAP. Para schema/ACL rode
  db:test e gates locais isolados; para interface use os scripts QA existentes.
- A matriz autenticada cobre responsividade, temas, zoom, teclado, axe e
  referencias. Use dados sinteticos; nao atualize baselines so para passar.
- CI Linux e a referencia para testes de modo POSIX. No Windows registre
  falhas reais de permissao; nao use skips ou altere assercoes para ocultar falhas.
- Execute matriz pesada na CI ou maquina local adequada, nunca na VPS de
  producao compartilhada. Nao pare containers ou processos de outros trabalhos.
- Confirme checks no SHA candidato, sem ignorar branch protection. Para release
  use runbooks existentes de imagem promovivel, backup e restore isolado.
- Producao, DNS, cobrancas e dados remotos continuam exigindo autorizacao.
  Configurar agentes ou documentacao nao exige deploy do CRM.
- Atualize WORKLOG, CHANGELOG e ATUALIZACOES com resultados reais e pendencias;
  sincronize o Obsidian. Nao apresente implementado como publicado.
