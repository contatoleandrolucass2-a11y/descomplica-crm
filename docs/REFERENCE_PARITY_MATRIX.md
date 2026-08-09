# Matriz de paridade da referência viva

Versão: 1.0. Data de corte: 2026-08-09.

“Paridade” significa preservar a hierarquia visual e a capacidade útil quando
ela pode ser sustentada por contratos seguros. Não significa copiar dados,
fórmulas, bundles, falhas de autenticação ou regras comerciais da referência.

## Legenda

- `F1 concluída`: entregue na fundação deste incremento.
- `segura existente`: rota funcional anterior, sem restauração visual nesta etapa.
- `protegida pendente`: rota existe, mas dados continuam indisponíveis.
- `adiada`: pertence a incremento explicitamente separado.

## Matriz

| ID     | Referência observada                                               | Estado seguro atual                            | Diferença visual                                                | Diferença funcional ou de dados                                       | Ajuste necessário                                                            | Prioridade   |
| ------ | ------------------------------------------------------------------ | ---------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------ |
| REF-01 | Dashboard: topbar, filtros, cards, roscas, funis, tabela e ranking | Fundação reconstruída sobre o snapshot real    | Identidade aproximada; ícones e densidade não são cópia literal | Sem projeção proporcional nem filtros dimensionais sem enforcement    | Executar QA autenticada; filtros só após read model/RLS próprios             | P0 concluída |
| REF-02 | Oportunidades: cabeçalho, gauge, filtros e comparativos            | Página dinâmica restaurada com `opportunities` | Gauge e composição recriados com tokens próprios                | Sem thresholds editoriais; janelas nulas ficam indisponíveis          | Comparar autenticada em homologação e conectar apenas novas fontes aprovadas | P0 concluída |
| REF-03 | Agendamentos: mesma família analítica de etapa                     | Página dinâmica restaurada com `appointments`  | Mesma fundação modular da etapa, sem bundle legado              | Mesmas restrições de meta e histórico                                 | Mesmo gate autenticado da REF-02                                             | P0 concluída |
| REF-04 | Visitas: mesma família analítica de etapa                          | Página dinâmica restaurada com `visits`        | Mesma fundação modular da etapa                                 | Mesmas restrições de meta e histórico                                 | Mesmo gate autenticado da REF-02                                             | P0 concluída |
| REF-05 | Pastas: mesma família analítica de etapa                           | Página dinâmica restaurada com `folders`       | Mesma fundação modular da etapa                                 | Mesmas restrições de meta e histórico                                 | Mesmo gate autenticado da REF-02                                             | P0 concluída |
| REF-06 | Vendas: mesma família analítica de etapa                           | Página dinâmica restaurada com `sales`         | Mesma fundação modular da etapa                                 | Sem cálculo ou prêmio comercial adicional                             | Mesmo gate autenticado da REF-02                                             | P0 concluída |
| REF-07 | Ranking: pódio, filtros, tabela e pontuação                        | Ranking server-rendered seguro já existente    | Paridade visual avançada ainda não executada                    | Leitura Qlik direta continua proibida; usa read model normalizado     | Incremento próprio com fonte e regra oficial                                 | P1 separada  |
| REF-08 | Canal de Parcerias: banner, filtros, cards e ranking               | Placeholder protegido por `crm.ranking.view`   | Banner, cards e ranking ainda ausentes                          | Fonte de leitura aprovada ainda não existe                            | Definir contrato, permissão e RLS antes de construir                         | P1 separada  |
| REF-09 | Configurações: índice de áreas                                     | Índice protegido já existente                  | Restauração visual fora desta fundação                          | Catálogo e permissões já são seguros                                  | Harmonizar visualmente em incremento posterior sem mudar contratos           | P2           |
| REF-10 | Metas: formulários mensais, semanais e diários                     | Server Component + Server Action/RPC auditada  | Restauração visual detalhada fora desta fundação                | Fonte `crm_funnel_goals` disponível; regras atuais preservadas        | Revisar somente apresentação em incremento dedicado                          | P2           |
| REF-11 | Metas de parcerias: formulário do canal                            | Server Component + Server Action/RPC auditada  | Restauração visual detalhada fora desta fundação                | Fonte `crm_funnel_goals` disponível; escopo seguro preservado         | Revisar somente apresentação junto ao Canal de Parcerias                     | P1 separada  |
| REF-12 | Metas de pontos: pesos e objetivos                                 | Configuração normalizada e auditada            | Restauração visual detalhada e ranking avançado pendentes       | Pesos existem; novas regras de pontuação não podem ser inferidas      | Incremento de ranking com regra oficial                                      | P1 separada  |
| REF-13 | Simulação: índice dos simuladores                                  | Não implementada                               | Página inteira ausente no destino seguro                        | Relação entre nomes WF13–WF16 e rotas não foi oficialmente confirmada | Confirmar catálogo, permissões e destinos antes de criar rotas               | P1 separada  |
| REF-14 | Associativo fluxo linear: formulário e cálculo                     | Não implementada; contrato legado não copiado  | Formulário e resultado ausentes                                 | Fórmula, parâmetros e autoridade comercial não estão versionados      | Fornecer especificação oficial, testes e autorização server-side             | P1 separada  |
| REF-15 | Documentação: formulário e cálculo                                 | Não implementada; contrato legado não copiado  | Formulário e resultado ausentes                                 | Fórmula, parâmetros e autoridade comercial não estão versionados      | Fornecer especificação oficial, testes e autorização server-side             | P1 separada  |
| REF-16 | CAIXA: simulador                                                   | Não implementada; contrato legado não copiado  | Formulário e resultado ausentes                                 | Fonte e regra oficial ausentes                                        | Incremento CAIXA próprio, após aprovação da regra                            | P1 separada  |
| REF-17 | Tabela direta: formulário e cálculo                                | Não implementada; contrato legado não copiado  | Formulário e resultado ausentes                                 | Fórmula e parâmetros oficiais ausentes                                | Fornecer contrato oficial e testes                                           | P1 separada  |
| REF-18 | Tabela investidor: formulário e cálculo                            | Não implementada; contrato legado não copiado  | Formulário e resultado ausentes                                 | Fórmula e parâmetros oficiais ausentes                                | Fornecer contrato oficial e testes                                           | P1 separada  |

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
6. Regras editoriais de ritmo, premiação, roleta, ranking avançado e
   simuladores não fazem parte da fundação.

## Critério de avanço

Uma linha adiada só pode avançar quando houver fonte oficial, contrato tipado,
permissão server-side, política RLS/grants quando aplicável, testes, documentação
e aprovação do incremento específico.
