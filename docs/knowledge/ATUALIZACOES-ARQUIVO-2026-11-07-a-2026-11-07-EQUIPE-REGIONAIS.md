## Retomada: regionais pendentes e visibilidade do resumo — 07/11/2026

- Pedido: buscar vínculo regional dos seis corretores pendentes em outros relatórios e mostrar nas duas tabelas do popup e no resumo; investigar a tabela abaixo dos quatro cards que o usuário não visualiza.
- Git comum confirmado; checkout inicial limpo, HEAD/main 9d8ad1cd01c1d2fd775283a4cb57bacc11ee583e. Branch de trabalho codex/equipe-regionais-resumo-20261107. Fetch sem divergência. GitHub main CI documental 42250061953 success; CI funcional 42230895044 success no SHA 9ee2c0cf.
- Health público em 2026-11-07T05:57:06.551Z: HTTP 200/status ok/version 9ee2c0cf7fe11df21efeb58cc19c615d71058948. Código integrado documental e runtime permanecem distintos. Fonte: https://crm.descomplicapro.com.br/api/health e GitHub do repositório.
- Notas pertinentes recuperadas do checkout e Obsidian. Evidência anterior não substitui consulta atual dos relatórios nem comprova visibilidade autenticada; investigar sem inferir Regional pelo gerente e sem exportar dados privados. Nenhuma nova migration ou ingestão aplicada nesta abertura.

### Investigação e preparação

- GET de metadata via sessão dedicada Salesforce na VPS confirmou os campos de
  pessoa Regional em Oportunidades, Pastas, Visitas e Vendas. Projeção anterior
  descartava esses nomes. Execuções observacionais delimitadas por corretor,
  sem salvar relatórios nem publicar/exportar dados, confirmaram30ativos e cinco
  pendentes; dois com evidência própria e três sem registros nas quatro fontes.
  GET inicial truncava Oportunidades/Pastas em2000linhas e não foi usado como
  prova de ausência; consultas por corretor retornaram allData=true.
- Última evidência própria dos dois casos presentes: Visitas em06/11/2026 e
  Oportunidades em13/10/2026, com gerente oficial coincidente e Regional único
  nessas datas. Histórico contém dois regionais, portanto não atribuir por
  gerente nem descartar mudança de vínculo. Cadeia Owner.Manager foi descartada:
  zero coincidências com os25vínculos regionais conhecidos.
- Nova aba da rota publicada, usando sessão já autenticada e CUA, mostrou o
  resumo com cinco gerentes e total30. Não foi reproduzida ausência completa;
  em1280x585 a quinta linha ficava parcialmente oculta pela rolagem interna.
  Ajuste específico para desktop de altura<=650 mantém cinco linhas e total
  visíveis em testes sintéticos nos três temas. Sem captura nominal em arquivo.
- Browser final:48layouts/72popups/50verificações do resumo/12de indicadores,
  aprovado. Testes backend novos3/3 aprovados após corrigir fixture de Visitas
  sem Unidade de Negócio; primeira falha preservada como evidência. Prettier
  dos quatro arquivos backend aprovado. CI completa e ativação ainda pendentes.
- Produtor aditivo reutiliza regional_manager_name; sem migration/RPC/ACL nova.
  Coletor observado ativo em0307bd47, com quatro drop-ins preservados. Trocar
  somente a imagem do app não muda esse produtor; preparar atualização imutável,
  backup, CAS, encerramento natural do ciclo e duas cargas conciliadas.
- Revisão independente encontrou placeholder Salesforce "-" tratado como pessoa.
  Corrigido na projeção das cinco fontes e no observador comum; observação recente
  ausente continua bloqueando histórico antigo. Foco regional7/7 e transform10/10
  aprovados. ESLint sem erros e apenas dois warnings preexistentes; novo warning
  removido. Helper operacional privado preparado e self-test aprovado, sem aplicar.
