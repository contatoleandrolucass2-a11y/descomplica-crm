# Matriz de paridade da referência viva

Versão: 1.2. Data de corte: 2026-08-28.

“Paridade” significa preservar a hierarquia visual e a capacidade útil quando
ela pode ser sustentada por contratos seguros. Não significa copiar dados,
fórmulas, bundles, falhas de autenticação ou regras comerciais da referência.

## Legenda

- `P0 concluída`: composição entregue sobre contratos funcionais já validados.
- `P0 visual`: composição entregue; fontes ausentes continuam explícitas.
- `motor bloqueado`: formulário existe, mas não calcula nem persiste.

## Matriz

| ID     | Referência observada                                               | Estado seguro atual                            | Diferença visual                                                | Diferença funcional ou de dados                                    | Ajuste necessário                                                            | Prioridade           |
| ------ | ------------------------------------------------------------------ | ---------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------- | -------------------- |
| REF-01 | Dashboard: topbar, filtros, cards, roscas, funis, tabela e ranking | Fundação reconstruída sobre o snapshot real    | Identidade aproximada; ícones e densidade não são cópia literal | Sem projeção proporcional nem filtros dimensionais sem enforcement | Comparar autenticada em homologação; filtros só após read model/RLS próprios | P0 concluída         |
| REF-02 | Oportunidades: cabeçalho, gauge, filtros e comparativos            | Página dinâmica restaurada com `opportunities` | Gauge e composição recriados com tokens próprios                | Sem thresholds editoriais; janelas nulas ficam indisponíveis       | Comparar autenticada em homologação e conectar apenas novas fontes aprovadas | P0 concluída         |
| REF-03 | Agendamentos: mesma família analítica de etapa                     | Página dinâmica restaurada com `appointments`  | Mesma fundação modular da etapa, sem bundle legado              | Mesmas restrições de meta e histórico                              | Mesmo gate autenticado da REF-02                                             | P0 concluída         |
| REF-04 | Visitas: mesma família analítica de etapa                          | Página dinâmica restaurada com `visits`        | Mesma fundação modular da etapa                                 | Mesmas restrições de meta e histórico                              | Mesmo gate autenticado da REF-02                                             | P0 concluída         |
| REF-05 | Pastas: mesma família analítica de etapa                           | Página dinâmica restaurada com `folders`       | Mesma fundação modular da etapa                                 | Mesmas restrições de meta e histórico                              | Mesmo gate autenticado da REF-02                                             | P0 concluída         |
| REF-06 | Vendas: mesma família analítica de etapa                           | Página dinâmica restaurada com `sales`         | Mesma fundação modular da etapa                                 | Sem cálculo ou prêmio comercial adicional                          | Mesmo gate autenticado da REF-02                                             | P0 concluída         |
| REF-07 | Ranking: pódio, filtros, indicadores, tabela e pontuação           | Guard e composição fail-closed                 | Estrutura preservada com bloqueio explícito                     | Fórmula/pesos legados não são autoridade; nenhuma pontuação ativa  | Importar política oficial, gates, grants e casos de ouro                     | Bloqueado            |
| REF-08 | Canal de Parcerias: banner, filtros, cards, pódios e rankings      | Página protegida sem consulta Qlik             | Composição completa com estados de integração pendente          | Fonte segura de leitura do canal ainda não existe                  | Definir read model/RLS antes de conectar dados                               | P0 visual            |
| REF-09 | Configurações: índice de áreas                                     | Índice protegido por `crm.settings.view`       | Hub analítico restaurado                                        | Links de gestão respeitam `crm.settings.manage`                    | Manter contratos atuais                                                      | P0 concluída         |
| REF-10 | Metas: formulários mensais, semanais e diários                     | Preview e rascunho privado versionado          | Hierarquia visual restaurada                                    | Nenhuma proposta altera configuração ativa                         | Aprovar política, owner, casos de ouro, gate, coorte, grant e rollback       | Rascunho seguro      |
| REF-11 | Metas de parcerias: formulário do canal                            | Mesmo contrato fechado de rascunho             | Hierarquia visual restaurada                                    | Associações e metas oficiais não são presumidas                    | Fornecer política e escopo oficiais                                          | Rascunho seguro      |
| REF-12 | Metas de pontos: pesos e objetivos                                 | Preview e rascunho privado versionado          | Cards, seções e feedback restaurados                            | Não grava pesos ativos nem desbloqueia ranking                     | Política oficial, casos de ouro, gates e grants                              | Rascunho seguro      |
| REF-13 | Simulação: índice dos simuladores                                  | Hub guardado por `crm.simulators.view`         | Seis jornadas e fluxo seguro visíveis                           | Canário depende de duas flags server-side                          | Validar cada motor em homologação Master                                     | Canário isolado      |
| REF-14 | Associativo fluxo linear: formulário e resultado WF13              | Formulário, resultado e memória oficial        | Paridade PDF 2 + ranking e anuais 15/12                         | Fórmula `wf13-1.3.0`; execução Master-only por gate independente   | Validação funcional humana do caso de ouro e matriz Looker                   | Canário WF13 isolado |
| REF-15 | Documentação: formulário e resultado WF16                          | Motor tipado e server-side                     | Seções, opções, resultados e memória                            | Referência congelada não autoriza produção                         | Smoke Master e aprovação comercial antes de produção                         | Canário isolado      |
| REF-16 | CAIXA: simulador                                                   | Motor tipado, indicativo e server-side         | Jornada, campos, resultados e memória                           | Resultado exige confirmação externa da CAIXA                       | Smoke Master e validação da política                                         | Canário isolado      |
| REF-17 | Tabela Direta: formulário e resultado WF14                         | Motor tipado e server-side                     | Dois cenários e cronograma reconciliado                         | Referência congelada não autoriza produção                         | Smoke Master e aprovação comercial                                           | Canário isolado      |
| REF-18 | Tabela Investidor: formulário e resultado WF15                     | Motor tipado, estoque fail-closed              | Oito cenários e reconciliação em centavos                       | Sem unidade conciliada, nenhum cenário é calculado                 | Conectar somente fonte oficial server-side                                   | Canário condicionado |
| REF-19 | Tabelão: filtros, ordenação e menor preço                          | Cliente same-origin + fonte server-side        | Filtros, loading, vazio, erro e atualização                     | Não afirma disponibilidade ou reserva                              | Provisionar contrato oficial privado                                         | Canário condicionado |
| REF-20 | Discador: hub operacional                                          | Shell protegido sem telefonia                  | Hierarquia e cartões migrados                                   | Campanhas, agentes e chamadas desligados                           | Incremento operacional separado                                              | Em desenvolvimento   |
| REF-21 | Previsão Final de Semana: abas, totais e tabela                    | GET sintético e POST bloqueado                 | Semana, visitas, vendas e estados preparados                    | Nenhuma escrita ou dado operacional ativo                          | Contrato e owner oficiais antes de qualquer escrita                          | Em desenvolvimento   |

## Diferenças intencionais da fundação

1. A referência pública não exige sessão; o destino redireciona qualquer acesso
   comercial anônimo para `/login`.
2. A referência mostra métricas e projeções sem contrato versionado. O destino
   mostra somente campos do read model e usa “Indisponível” quando falta fonte.
3. Razões entre etapas são rotuladas como relação entre volumes agregados, não
   como conversão de coorte.
4. A projeção proporcional observada na referência não foi reproduzida.
5. Filtros de gerente, responsável, empresa e canal detalhado permanecem
   indisponíveis até existir enforcement no servidor e no banco.
6. Regras editoriais de ritmo, premiação, roleta, ranking avançado e motores
   funcionais dos simuladores não fazem parte da fundação visual.

## Critério de avanço

Um motor bloqueado ou uma integração pendente só pode avançar quando houver
fonte oficial, contrato tipado, permissão server-side, política RLS/grants
quando aplicável, testes, documentação e aprovação do incremento específico.
