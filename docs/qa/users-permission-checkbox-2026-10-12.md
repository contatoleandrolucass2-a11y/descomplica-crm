# Evidência: caixas de acesso e padrão do perfil

Data: 2026-10-12

## Escopo

- Referência aprovada:
  `/srv/descomplica-design-drafts/2026-10-10/draft-crm-para-vps/outputs/modelo-site.html#users`.
- Rota alterada: `/admin/usuarios`.
- Objetivo: usar a própria caixa para marcar/desmarcar acessos e restaurar a
  configuração herdada pelo botão `Usar padrão do perfil`.
- Fora do escopo funcional: motores e regras de Associativo, Tabela Direta,
  Tabela Investidor e Tabelão.

## Contrato conferido

1. A caixa marcada representa acesso liberado; desmarcada representa ausência
   de acesso.
2. O clique atualiza o rascunho imediatamente, sem o antigo passo `Incluir na
alteração` e sem seletor separado Permitir/Negar/Restaurar.
3. Uma mudança ainda não salva recebe indicador e resumo próprio.
4. `Usar padrão do perfil` restaura a herança do papel e não altera o papel.
5. O envio misto de `allow`, `deny` e `inherit` é atômico e continua sujeito às
   guardas, hierarquia, escopo e auditoria existentes.

## Evidência automatizada válida

- Testes direcionados Vitest: 5 arquivos, 55 testes aprovados.
- Banco: 27 arquivos pgTAP, 1.151 testes aprovados depois de reset limpo das 47
  migrations.
- Build Next.js 16.3.8: 45 rotas geradas.
- Matriz visual autenticada em modo de promoção:
  - 154 checks responsivos;
  - 88 checks de tema;
  - 242 checks Axe;
  - 242 comparações candidato/baseline;
  - 110 checks de zoom.
- Onze referências de `/admin/usuarios` foram promovidas: sete viewports,
  Claro/Médio/Escuro em 1.440 × 900 e Escuro mobile em 390 × 844.
- As capturas mostram o tique visível em Claro e Escuro. A suíte não detectou
  overflow horizontal, regressão de acessibilidade ou erro de console.
- Os quatro simuladores repetiram todos os breakpoints; o Associativo aprovou
  30 capturas manuais e o Tabelão repetiu filtros, tabela, impressão e mapas.
- Suíte completa: 126 arquivos Vitest com 2.464 aprovados e seis ignorados, 83
  testes Node e E2E de release com 19 aprovados e um skip previsto. O E2E
  confirmou as 25 rotas por perfil, Administrador sem capacidades de Master,
  MFA e limpeza das nove identidades sintéticas.
- Restore isolado: 47 migrations, 27 arquivos e 1.151 pgTAP aprovados tanto na
  origem quanto no banco restaurado, com grants/owners e fingerprint
  preservados. `pnpm audit`, OSV e gitleaks não encontraram achados.
- O `verify` visual pós-commit repetiu 154/88/242/242/110 sem promover ou
  regravar referências.

## Limite registrado

Um ensaio adicional com duas identidades locais sintéticas foi interrompido
por timeout no login antes de chegar à tela; ele não integra a evidência de
aprovação. O bloco de limpeza resetou o Supabase local e removeu as identidades.
Nenhuma credencial ou conta de produção foi usada.
