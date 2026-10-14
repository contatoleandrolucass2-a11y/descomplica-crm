# Paridade visual de Usuarios e acessos

Data: 11/10/2026. Branch: `codex/alinhar-usuarios-ao-draft`.

## Referencia e causa

Fonte obrigatoria:
`/srv/descomplica-design-drafts/2026-10-10/draft-crm-para-vps/outputs/modelo-site.html#users`.

A publicação anterior manteve dados e autorização reais, mas não a composição
aprovada. Foram acrescentados quatro indicadores e todos os grupos de
permissões eram exibidos em sequência. Isso deslocava a ação principal,
aumentava a carga de leitura e levava o desktop a 2.592 px. Classificação UX:
severidade 2, porque a tarefa continuava possível, porém mais lenta e distante
do modelo aprovado.

## Ajustes

- Remoção dos indicadores de total, ativos, pendentes e revogados.
- Mestre-detalhe com coluna de 286 px para Pessoas e detalhe flexível.
- Busca compacta e filtros Todos, Ativos, Revogados e Pendentes em chips.
- Lista real paginada com estado por ponto de cor e alternativa textual.
- Perfil e status no cabeçalho; troca de papel preservada em disclosure.
- Quatro abas: Comercial, Simuladores, Configurações e Administração.
- Uma aba de permissões por vez, com busca, origem do acesso e operações em
  lote permitir/negar/restaurar preservadas.
- Região de permissões rolável e focável no desktop; fluxo vertical no mobile.
- Rodapé de alteração, configurações avançadas e nota do catálogo real.
- Tokens semânticos nos temas Claro, Médio e Escuro.

Nenhum nome, contagem ou estado demonstrativo foi copiado. Nenhuma regra de
papel, Server Action, RPC, trigger, RLS ou simulador foi alterada.

## Evidência visual

As onze referências de `/admin/usuarios` foram promovidas: sete larguras no
tema Claro, três temas em 1.440 x 900 e Escuro em 390 x 844. Nenhuma outra
referência mudou.

| Verificação                        | Resultado |
| ---------------------------------- | --------- |
| Responsividade                     | 154/154   |
| Tema                               | 88/88     |
| Axe                                | 242/242   |
| Comparações candidato/referência   | 242/242   |
| Zoom                               | 110/110   |
| Altura de Usuários em 1.440 x 900  | 1.187 px  |
| Limite de regressão em 1.440 x 900 | 1.200 px  |
| Navegação dos quatro simuladores   | 40/40     |
| Capturas manuais do Associativo    | 30/30     |

A primeira medição após a recomposição ainda tinha 1.370 px e foi rejeitada
pelo limite novo. Ao limitar a lista no desktop, o Axe apontou uma região
rolável sem foco. A promoção só foi permitida após `tabpanel` focável e nova
execução integral verde. A conta efêmera e as fixtures sintéticas foram
removidas pelo harness.

## Segurança funcional preservada

- Administrador não recebe nem atribui Master.
- Administrador não cria, promove, desativa nem altera papel ou permissões de
  outra conta Administrador.
- Somente Master recebe controles mutáveis para uma conta Administrador.
- Autoalteração continua bloqueada.
- Alterações de papel, status e exceções mantêm confirmação, motivo e auditoria.
- Os quatro simuladores não tiveram componente, campo, motor ou regra alterada.

## Arquivos centrais

- `app/(protected)/admin/usuarios/UserAccessManager.tsx`
- `app/(protected)/admin/usuarios/page.tsx`
- `app/(protected)/admin/admin-canvas.css`
- `scripts/qa/authenticated-visual.mjs`
- `tests/access-management.test.tsx`
- `tests/canvas-management-layout.test.tsx`
- `docs/qa/reference-parity/target-authenticated/`
