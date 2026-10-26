const metricHelp = {
  spend: {
    name: 'Investimento',
    calculation: 'Soma do valor gasto pelas campanhas selecionadas no período. É o gasto realizado, não o orçamento configurado nem o saldo da conta.',
    impact: 'Determina o custo total da aquisição. Gastar mais não garante mais resultados ou resultados melhores.',
    improvement: 'Compare o gasto com o volume, o custo e a qualidade dos resultados. Teste ajustes de orçamento gradualmente e acompanhe o efeito antes de ampliar.',
    example: 'R$ 300 + R$ 200 em duas campanhas = R$ 500 investidos.'
  },
  results: {
    name: 'Resultados',
    calculation: 'Soma dos eventos de resultado no período. Nesta prévia, resultados são cadastros. Conversas iniciadas no WhatsApp devem ser analisadas separadamente.',
    impact: 'Mostra o volume gerado e entra no cálculo do custo por resultado. Volume de cadastros não comprova qualificação ou vendas.',
    improvement: 'Investigue o caminho entre anúncio, clique e cadastro. Teste clareza da oferta, formulário e página de destino, acompanhando também a qualidade dos contatos.',
    example: '20 cadastros + 30 cadastros = 50 resultados.'
  },
  cpl: {
    name: 'Custo por resultado',
    calculation: 'Investimento total ÷ resultados totais. Nesta prévia, equivale ao custo por cadastro. Sem resultados, o custo não pode ser calculado.',
    impact: 'Indica quanto custa gerar cada resultado e permite comparar o custo com o teto definido. Um custo alto, sozinho, não revela a causa.',
    improvement: 'Compare CTR, CPC e conversão após o clique. Teste criativo, oferta e destino separadamente para identificar onde há perda, preservando a qualidade dos leads.',
    example: 'R$ 500 ÷ 25 cadastros = R$ 20 por cadastro.'
  },
  ctr: {
    name: 'CTR — Taxa de cliques',
    calculation: 'Cliques ÷ impressões × 100. Nesta prévia, utiliza o mesmo total de cliques empregado no CPC. Cliques totais e cliques no link são definições diferentes.',
    impact: 'Indica a proporção de exibições que gerou cliques. Com CPM constante, CTR maior reduz o CPC. CTR alto não garante cadastros ou vendas.',
    improvement: 'Teste imagem ou vídeo, título, oferta e chamada para ação. Verifique a adequação ao público e acompanhe a conversão após o clique para evitar atrair apenas curiosidade.',
    example: '200 cliques ÷ 10.000 impressões × 100 = 2%.'
  },
  cpc: {
    name: 'CPC — Custo por clique',
    calculation: 'Investimento total ÷ cliques totais. Mantenha a mesma definição de clique ao comparar campanhas.',
    impact: 'Mostra o custo para gerar um clique. Em conjunto com a conversão após o clique, influencia o custo por resultado. Um clique barato pode não gerar um lead qualificado.',
    improvement: 'Investigue CTR e CPM. Teste criativos e mensagens mais relevantes, mantendo coerência com a página de destino. Avalie custo e qualidade dos resultados junto com o CPC.',
    example: 'R$ 500 ÷ 250 cliques = R$ 2 por clique.'
  },
  cpm: {
    name: 'CPM — Custo por mil impressões',
    calculation: 'Investimento total ÷ impressões totais × 1.000. Impressões são exibições do anúncio; não representam pessoas únicas.',
    impact: 'Mostra o custo da exposição. Com CTR constante, CPM maior aumenta o CPC. Um CPM baixo, sozinho, não significa melhor desempenho.',
    improvement: 'Compare público, posicionamentos e períodos equivalentes. Investigue restrições de público e repetição das exibições; teste alternativas e acompanhe o custo por resultado.',
    example: 'R$ 500 ÷ 100.000 impressões × 1.000 = R$ 5.'
  },
  radar: {
    name: 'Radar — Perfil de desempenho',
    calculation: 'Cada métrica é normalizada entre o menor e o maior valor das campanhas escolhidas: (valor − mínimo) ÷ (máximo − mínimo) × 100. Os eixos de custo são invertidos. Valores iguais recebem 50.',
    impact: 'Destaca diferenças relativas entre as campanhas. A escala muda quando a seleção muda e não representa uma nota absoluta de qualidade. Mais investimento não significa melhor desempenho.',
    improvement: 'Use o radar para levantar pontos de investigação. Confira os valores originais nos pontos e analise cada métrica separadamente antes de decidir.',
    example: 'Um eixo com 100 representa um extremo dentro desta seleção, não uma meta alcançada.'
  }
};

const helpDialog = document.createElement('dialog');
helpDialog.id = 'metric-help';
helpDialog.setAttribute('aria-labelledby', 'metric-help-title');
document.body.append(helpDialog);
document.addEventListener('click', event => {
  const trigger = event.target.closest('[data-metric-info]');
  if (!trigger) return;
  const help = metricHelp[trigger.dataset.metricInfo];
  if (!help) return;
  closeChartFilters();
  helpDialog.innerHTML = `<div class="dialog-head"><h2 id="metric-help-title">${help.name}</h2><button class="icon" aria-label="Fechar explicação">✕</button></div><dl><dt>Como é calculada</dt><dd>${help.calculation}</dd><dt>O que afeta</dt><dd>${help.impact}</dd><dt>Como melhorar · pontos a investigar</dt><dd>${help.improvement}</dd></dl><div class="metric-example"><strong>Exemplo</strong><p>${help.example}</p></div><p class="metric-note">Use o mesmo período e a mesma definição de resultado nas comparações. Taxas e custos são calculados pelos totais, não pela média simples das campanhas. Sugestões são hipóteses de teste, não garantias.</p>`;
  helpDialog.querySelector('button').onclick = () => helpDialog.close();
  helpDialog.showModal();
});
helpDialog.addEventListener('click', event => {
  const bounds = helpDialog.getBoundingClientRect();
  if (event.target === helpDialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) helpDialog.close();
});
