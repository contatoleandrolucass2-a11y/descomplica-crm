(() => {
 const choices=[
  ['table','Tabela de campanhas','Indicadores, tetos e acesso à campanha','<path d="M18 20h116v72H18zM18 44h116M18 68h116M60 20v72M100 20v72" fill="none"/>'],
  ['bars','Colunas','Comparação entre campanhas','<path d="M25 90V60h22v30M64 90V36h22v54M103 90V16h22v74"/>'],
  ['horizontal','Barras horizontais','Nomes longos e comparação','<path d="M25 24h100v14H25zM25 49h70v14H25zM25 74h45v14H25z"/>'],
  ['line','Linhas','Evolução ao longo do tempo','<path d="m20 80 28-28 25 12 26-38 32 15" fill="none"/><g><circle cx="20" cy="80" r="3"/><circle cx="48" cy="52" r="3"/><circle cx="73" cy="64" r="3"/><circle cx="99" cy="26" r="3"/></g>'],
  ['area','Área','Evolução com volume destacado','<path d="m20 80 28-28 25 12 26-38 32 15v49H20z" opacity=".3"/><path d="m20 80 28-28 25 12 26-38 32 15" fill="none"/>'],
  ['donut','Rosca','Participação no total','<circle cx="76" cy="54" r="33" fill="none" stroke-width="18" opacity=".25"/><circle cx="76" cy="54" r="33" fill="none" stroke-width="18" stroke-dasharray="120 208"/>'],
  ['radar','Radar','Perfil relativo de desempenho','<path d="m76 13 39 22v43L76 99 37 78V35z" fill="none" opacity=".3"/><path d="m76 27 25 14-5 30-20 16-28-16 4-25z" opacity=".45"/>'],
  ['funnel','Funis comparativos','Cliques, resultados e qualificados','<path d="M20 22h112v14H20zM34 46h84v14H34zM48 70h56v14H48z"/>'],
  ['kpi','Indicador','Nome e valor em destaque','<rect x="20" y="15" width="112" height="78" rx="9" fill="none"/><text x="33" y="43" stroke="none" font-size="12">Investimento</text><text x="33" y="72" stroke="none" font-size="20">R$ 1.250</text>'],
  ['scatter','Dispersão','Investimento versus resultados','<g><circle cx="30" cy="79" r="6"/><circle cx="57" cy="62" r="7"/><circle cx="90" cy="42" r="6"/><circle cx="121" cy="30" r="8"/></g>']
 ].filter(([type])=>types[type]&&(type!=='table'||integration.view==='macro'));
 const dialog=$('#library'),items=$('#library-items'),heading=dialog.querySelector('h2'),intro=dialog.querySelector('p');
 let picked=null;
 function drawTypes(){
  picked=null;heading.textContent='Escolha o tipo de gráfico';intro.textContent='1. Escolha o visual · 2. Defina o que deseja analisar';items.className='visual-chart-library';
  items.innerHTML=choices.map(([type,name,description,drawing])=>`<button type="button" data-chart-style="${type}"><svg viewBox="0 0 152 110" aria-hidden="true"><path class="preview-axis" d="M15 12v85h124" fill="none"/>${drawing}</svg><b>${name}</b><small>${description}</small></button>`).join('');
 }
 function drawOptions(type){
  picked=type;const choice=choices.find(c=>c[0]===type);heading.textContent=choice[1]+' · o que exibir?';intro.textContent='2. Configure os dados deste gráfico';items.className='visual-chart-config';
  const fixed=['funnel','scatter','radar','table'].includes(type),allowed=type==='donut'?Object.entries(metricLabels).filter(([metric])=>['spend','results'].includes(metric)):Object.entries(metricLabels);
  const start=$('#start').value,end=$('#end').value;
  items.innerHTML=`<form id="chart-library-form"><label>${fixed?'Análise':'Métrica'}<select name="metric" ${fixed?'disabled':''}>${(fixed?[[['funnel','table'].includes(type)?'results':type==='scatter'?'spend':'ctr',type==='table'?'Tabela de campanhas':type==='funnel'?'Etapas de conversão':type==='scatter'?'Investimento × resultados':'Perfil de seis métricas']]:allowed).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></label>${fixed?`<p class="library-guidance">${type==='table'?'Campanhas com investimento, resultados, custo, teto e situação.':type==='funnel'?'Etapas disponíveis da origem, com volumes e taxas. Etapas sem dados ficam ocultas.':type==='scatter'?'Investimento (R$) no eixo horizontal e resultados no vertical.':'Investimento, resultados, custo por resultado, CTR, CPC e CPM em escala relativa; custos invertidos.'}</p>`:''}<label>Período<select name="period"><option value="global">Seguir filtros gerais</option><option value="today">Hoje</option><option value="week">Esta semana</option><option value="month">Este mês</option><option value="custom">Personalizado</option></select></label><div class="library-dates" hidden><label>De<input type="date" name="start" value="${start}"></label><label>Até<input type="date" name="end" value="${end}"></label></div>${['line','area'].includes(type)?'<label>Agrupamento<select name="group"><option value="day">Por dia</option><option value="hour">Por hora</option><option value="campaign">Por campanha</option></select></label>':''}<fieldset><legend>${typeof integration==='undefined'||!integration.view.startsWith('micro')?'Campanhas':'Conjuntos / anúncios'}</legend><label class="library-check"><input type="checkbox" name="inherit" checked> Seguir seleção dos filtros gerais</label><div class="library-campaigns"><label class="library-check"><input type="checkbox" name="all"> Selecionar todas</label>${campaigns.map((campaign,index)=>`<label class="library-check"><input type="checkbox" name="campaign" value="${index}" ${selected.includes(index)?'checked':''}> ${escapeLabel(campaign.name)}</label>`).join('')}</div></fieldset><p class="library-error" role="alert"></p><div class="library-actions"><button type="button" data-library-back>← Tipos de gráfico</button><button class="primary" type="submit">Adicionar ao canvas</button></div></form>`;
  syncCampaignSelection(items.querySelector('form'));
 }
 function syncCampaignSelection(form){
  const options=[...form.querySelectorAll('[name="campaign"]')],all=form.querySelector('[name="all"]');
  all.checked=options.length>0&&options.every(input=>input.checked);
  all.indeterminate=options.some(input=>input.checked)&&!all.checked;
 }
 $('#add').onclick=()=>{drawTypes();dialog.showModal();};
 items.onclick=event=>{const type=event.target.closest('[data-chart-style]')?.dataset.chartStyle;if(type)drawOptions(type);if(event.target.closest('[data-library-back]'))drawTypes();};
 items.onchange=event=>{
  const form=items.querySelector('form');if(!form)return;
  if(event.target.name==='period')form.querySelector('.library-dates').hidden=event.target.value!=='custom';
  if(event.target.name==='inherit'&&event.target.checked)form.querySelectorAll('[name="campaign"]').forEach(input=>input.checked=selected.includes(Number(input.value)));
  if(['campaign','all'].includes(event.target.name))form.querySelector('[name="inherit"]').checked=false;
  if(event.target.name==='all')form.querySelectorAll('[name="campaign"]').forEach(input=>input.checked=event.target.checked);
  syncCampaignSelection(form);
 };
 items.onsubmit=event=>{
  event.preventDefault();const form=event.target,values=new FormData(form),period=values.get('period'),start=values.get('start'),end=values.get('end'),inherited=values.has('inherit'),ids=values.getAll('campaign').map(Number);
  if(period==='custom'&&(!start||!end||start>end)){form.querySelector('.library-error').textContent='Informe um intervalo válido.';return;}
  if(!inherited&&!ids.length){form.querySelector('.library-error').textContent='Selecione ao menos uma campanha.';return;}
  const metric=['funnel','table'].includes(picked)?'results':picked==='scatter'?'spend':picked==='radar'?'ctr':values.get('metric');
  const card={id:uid(),type:picked,metric,period,group:values.get('group')||'campaign',span:picked==='table'?12:6,height:picked==='kpi'?184:384,start,end,campaignIds:inherited?null:ids};normalize(card);if(typeof existingChart==='function'&&existingChart(card)){showExistingChart(existingChart(card));return;}checkpoint();cards.push(card);dialog.close();render();$('#canvas').lastElementChild.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'center'});toast('Gráfico adicionado ao canvas.');
 };
})();
