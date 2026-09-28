# Publicacao autorizada por padrao

Fonte: pedido direto do usuario em 28/09/2026 para publicar alteracoes deste
projeto em qualquer chat, sem solicitar nova confirmacao a cada entrega.

## Escopo

Aplica-se exclusivamente ao Git comum
`C:/Users/Leandro Lucas/Documents/ChatGPT/DESCOMPLICA-CRM/.git` e seus worktrees.
Destino de aplicacao existente: `https://crm.descomplicapro.com.br`.
Publicar alteracoes concluidas depois da validacao. Nao esperar uma mensagem
adicional de autorizacao para o deploy normal. Pedido posterior de suspensao
ou nao publicacao prevalece.

Alteracoes apenas de documentacao ou ferramentas sao publicadas no Git e no
conhecimento curado; nao exigem reiniciar a aplicacao sem mudanca de runtime.
Nao disparar deploy em cada salvamento, checkout ou sincronizacao do Obsidian.

## Gates que permanecem obrigatorios

1. Preservar mudancas de terceiros; trabalhar em branch e revisar o diff.
2. Validar lint, tipos, testes e build. Conferir CI no SHA candidato, incluindo
   banco, restore isolado e QA de navegador pertinentes. Nao reduzir gates para
   obter aprovacao. Testes POSIX exigem Linux, sem mascarar falhas no Windows.
3. Integrar pelo PR com protecoes existentes. Confirmar se o main ainda
   corresponde ao candidato validado antes de publicar.
4. Usar imagem imutavel pelo SHA e comprovar seu ID/label e perfis de runtime,
   conforme `docs/release-candidate/PROMOTABLE_IMAGE_RUNTIME.md`.
5. Registrar versao/imagem anterior, verificar backup aplicavel e preparar
   rollback antes da troca. Nao expor segredos em logs ou artefatos.
6. Promover com compare-and-swap da versao esperada. Se outro deploy ocorreu,
   parar e reconciliar o estado; nao sobrescrever silenciosamente.
7. Conferir health e versao publicada, acesso anonimo negado e jornada afetada.
   Se a nova versao falhar, executar o rollback previsto e verificar recuperacao.
8. Registrar resultado, evidencia, limites e pendencias; sincronizar Obsidian.

Builds, suites extensas e carga sintetica rodam na CI ou ambiente isolado,
nao na VPS de producao compartilhada. Testes em producao devem ser limitados,
observacionais e interrompidos diante de erros ou degradacao.

## Limites

Esta autorizacao nao aprova cobrancas, novas contas, DNS, mudancas de acesso,
novas politicas financeiras, migrations remotas, importacoes ou exclusoes de
dados. Essas operacoes mantem seu escopo e aprovacao especifica. Workflows n8n
existentes: MCP, validacao antes da alteracao e releitura depois, sem fallback
REST. Uma falha real ou dependencia de negocio pendente deve ser relatada;
nunca afirmar que houve publicacao quando apenas houve commit ou merge.
