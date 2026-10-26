const $ = (s, root=document) => root.querySelector(s);
const campaigns=integration.entities;
const liveAdjustments=campaigns.map(()=>({spend:0,results:0,clicks:0,impressions:0}));
const metrics={spend:'Investimento',results:integration.resultName,cpl:integration.costName,ctr:'CTR',cpc:'CPC',cpm:'CPM'};
const metricLabels={...metrics,ctr:'CTR — Taxa de cliques',cpc:'CPC — Custo por clique',cpm:'CPM — Custo por mil impressões'};
const types={table:'Tabela de campanhas',kpi:'Indicador',funnel:'Funis comparativos',scatter:'Investimento × resultados',bars:'Colunas',horizontal:'Barras horizontais',line:'Linhas',area:'Área',donut:'Rosca',radar:'Radar'};
const key='descomplica-merged-canvas-v1-'+integration.scope; let editing=false,history=[],future=[],selected=campaigns.map((c,i)=>integration.selected.includes(c.id)?i:-1).filter(i=>i>=0),dragId=null,activeCardId=null;
const groupSelection=new Set();
const uid=()=>crypto.randomUUID();
const legacyFactoryDefinitions=[
 ...Object.keys(metrics).map(metric=>({metric,type:'kpi',period:'global',span:2,height:184,group:'campaign'})),
 {metric:'results',type:'funnel',period:'global',span:12,height:384,group:'campaign'},
 {metric:'cpl',type:'bars',period:'global',span:6,height:384,group:'campaign'},
 {metric:'spend',type:'line',period:'global',span:6,height:384,group:'day'},
 {metric:'spend',type:'scatter',period:'global',span:6,height:384,group:'campaign'},
 {metric:'results',type:'table',period:'global',span:12,height:384,group:'campaign'}
];
// Padrão aprovado na prévia local: seis indicadores e quatro linhas analíticas.
// Os gráficos herdam as campanhas dos filtros gerais; IDs demonstrativos nunca
// são promovidos para o CRM.
const requestedMacroDefinitions=[
 ...['spend','results','cpc','ctr','cpl','cpm'].map(metric=>({metric,type:'kpi',period:'global',span:2,height:184,group:'campaign'})),
 ...['today','week','month'].map(period=>({metric:'spend',type:'bars',period,span:4,height:384,group:'campaign'})),
 ...['today','week','month'].map(period=>({metric:'results',type:'horizontal',period,span:4,height:384,group:'campaign'})),
 ...['today','week','month'].map(period=>({metric:'results',type:'table',period,span:4,height:384,group:'campaign'})),
 {metric:'ctr',type:'radar',period:'global',span:12,height:384,group:'campaign'}
];
const factoryDefinitions=integration.view==='macro'?requestedMacroDefinitions:legacyFactoryDefinitions;
const materialize=definitions=>definitions.map(card=>({...card,id:uid(),start:integration.range.start,end:integration.range.end}));
const defaults=()=>materialize(factoryDefinitions);
const sameFactoryLayout=(value,definitions)=>Array.isArray(value)&&value.length===definitions.length&&value.every((card,index)=>{
 const expected=definitions[index];
 return ['metric','type','period','span','height','group'].every(field=>card[field]===expected[field]);
});
let cards;try{cards=JSON.parse(localStorage.getItem(key));if(!Array.isArray(cards)||cards.some(c=>!metricLabels[c.metric]||!types[c.type]))cards=null}catch{}cards??=defaults();
// Apply the requested initial indicator row once, preserving filters and other cards.
const indicatorRowVersion=key+'-six-indicators-v1';
try{
 if(!localStorage.getItem(indicatorRowVersion)){
  const initialIndicators=cards.slice(0,6);
  if(initialIndicators.length===6&&initialIndicators.every(card=>card.type==='kpi')){
   initialIndicators.forEach(card=>{card.span=2;card.height=184;});
   localStorage.setItem(key,JSON.stringify(cards));
  }
  localStorage.setItem(indicatorRowVersion,'1');
 }
}catch{}

// Move the former fixed table into every canvas, including campaign micro views.
{
 const migration=key+'-entity-table-widget-v2';
 if(!localStorage.getItem(migration)){
  if(!cards.some(c=>c.type==='table'))cards.push({id:uid(),metric:'results',type:'table',period:'global',span:12,height:384,group:'campaign'});
  localStorage.setItem(key,JSON.stringify(cards));localStorage.setItem(migration,'1');
 }
}
const cloneCards=value=>JSON.parse(JSON.stringify(value));
const profileKey='descomplica-canvas-profiles-v1-'+integration.scope;
let profileState;
try{profileState=JSON.parse(localStorage.getItem(profileKey))}catch{}
if(!profileState||!Array.isArray(profileState.items)||!profileState.items.length){
 const id=uid();profileState={activeId:id,defaultId:id,items:[{id,name:'Padrão',cards:cloneCards(cards)}]};
 localStorage.setItem(profileKey,JSON.stringify(profileState));
}else{
 const active=profileState.items.find(item=>item.id===profileState.activeId)||profileState.items[0];
 profileState.activeId=active.id;cards=cloneCards(active.cards);
 if(!profileState.items.some(item=>item.id===profileState.defaultId))profileState.defaultId=active.id;
}
function saveProfiles(){localStorage.setItem(profileKey,JSON.stringify(profileState));}
function activeProfile(){return profileState.items.find(item=>item.id===profileState.activeId)||profileState.items[0];}
// A primeira versão publicada criou no navegador o perfil de fábrica antigo.
// Troque somente esse perfil ainda intacto. Perfis e layouts personalizados
// permanecem preservados.
{
 const requestedDefaultVersion=profileKey+'-requested-macro-default-v1';
 try{
  if(integration.view==='macro'&&!localStorage.getItem(requestedDefaultVersion)){
   const standard=profileState.items.find(item=>item.id===profileState.defaultId);
   if(standard&&sameFactoryLayout(standard.cards,legacyFactoryDefinitions)){
    const approved=materialize(requestedMacroDefinitions);
    standard.cards=JSON.parse(JSON.stringify(approved));
    if(profileState.activeId===standard.id)cards=JSON.parse(JSON.stringify(approved));
    saveProfiles();localStorage.setItem(key,JSON.stringify(cards));
   }
   localStorage.setItem(requestedDefaultVersion,'1');
  }
 }catch{}
}
// Repair the layout affected by the former Organizar behavior. It forced every
// non-indicator card to half width and discarded the user's chosen sizes.
// Preserve card order and filters; restore the established canvas pattern:
// six indicators per row, three analytical cards per row and full-width funnel.
{
 const recoveryKey=key+'-organize-size-recovery-v1';
 const analytical=cards.filter(card=>card.type!=='kpi');
 const looksAutoOrganized=analytical.length>0&&analytical.every(card=>Number(card.span)===6&&Number(card.height)>=324&&Number(card.height)<=364);
 if(!localStorage.getItem(recoveryKey)&&looksAutoOrganized){
  cards=cards.map(card=>{
   if(card.type==='kpi')return {...card,span:2,height:184};
   if(card.type==='funnel')return {...card,span:12,height:384};
   return {...card,span:4,height:384};
  });
  const active=activeProfile();
  active.cards=cloneCards(cards);
  profileState.defaultId=active.id;
  saveProfiles();
  localStorage.setItem(key,JSON.stringify(cards));
  localStorage.setItem(recoveryKey,'1');
 }
}
const fmt=(n,m)=>n==null?'—':m==='results'?Math.round(n).toLocaleString('pt-BR'):m==='ctr'?n.toLocaleString('pt-BR',{maximumFractionDigits:2})+'%':n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const date=s=>new Date(s+'T12:00:00Z');const iso=d=>d.toISOString().slice(0,10);const short=s=>date(s).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'UTC'});
function range(c){return integratedRange(c)}
function rows(c){return integratedRows(c)}
function hourlyRows(){return []}
function aggregate(rs,m){return integratedAggregate(rs,m)}
function persist(){try{localStorage.setItem(key,JSON.stringify(cards));const active=activeProfile();if(active){active.cards=cloneCards(cards);saveProfiles();}$('#save-status').textContent='Layout salvo neste navegador'}catch{$('#save-status').textContent='Não foi possível salvar neste navegador'}}
function updateHistoryButtons(){$('#undo').disabled=!history.length;$('#redo').disabled=!future.length;}
function recordChange(snapshot){history.push(snapshot);if(history.length>30)history.shift();future=[];updateHistoryButtons();}
function checkpoint(){recordChange(JSON.stringify(cards));}
function toast(t){host.notice(t);$('#toast').textContent=t;$('#toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').style.display='none',2300)}
function options(obj,value){return Object.entries(obj).map(([k,v])=>`<option value="${k}" ${k===value?'selected':''}>${v}</option>`).join('')}
const labelMeasure=document.createElement('canvas').getContext('2d');
function measureLabel(text,font){labelMeasure.font=`500 ${font}px system-ui`;return labelMeasure.measureText(text).width;}
function escapeLabel(text){return String(text).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
function shortenChartLabel(text,width,font){
 if(measureLabel(text,font)<=width)return text;
 let shortened=text;
 while(shortened&&measureLabel(shortened+'…',font)>width)shortened=shortened.slice(0,-1);
 return shortened.trimEnd()+'…';
}
function wrapChartLabel(text,width,font,maxLines=2){
 const lines=[];let line='';
 for(const word of text.trim().split(/\s+/)){
  const candidate=line?line+' '+word:word;
  if(line&&measureLabel(candidate,font)>width){lines.push(line);line=word;}
  else line=candidate;
 }
 if(line)lines.push(line);
 const visible=lines.slice(0,maxLines).map(value=>shortenChartLabel(value,width,font));
 if(lines.length>maxLines)visible[maxLines-1]=shortenChartLabel(lines.slice(maxLines-1).join(' '),width,font);
 return visible;
}
function chartValue(value,metric,width,font,includeCurrency=false){
 const full=includeCurrency?fmt(value,metric):fmt(value,metric).replace(/^R\$\s*/,'');
 if(measureLabel(full,font)<=width)return full;
 const prefix=includeCurrency&&!['results','ctr'].includes(metric)?'R$ ':'';
 const suffix=metric==='ctr'?'%':'';
 for(const digits of [1,0]){
  const compact=prefix+value.toLocaleString('pt-BR',{notation:'compact',maximumFractionDigits:digits})+suffix;
  if(measureLabel(compact,font)<=width)return compact;
 }
 return prefix+value.toExponential(0).replace('.',',')+suffix;
}
function cardMinHeight(card){
 if(card.type==='kpi')return 164;
 if(card.type==='horizontal')return Math.min(284,124+chartCampaigns(card).length*20);
 if(card.type==='table')return 224;
 return card.type==='funnel'?184:224;
}
function comparablePeriodCards(card){
 if(integration.view==='macro')return [];
 if(!['bars','horizontal','line','area'].includes(card.type))return [];
 const ids=JSON.stringify([...chartCampaigns(card)].sort((a,b)=>a-b));
 return cards.filter(other=>other.type===card.type&&other.metric===card.metric&&other.group===card.group&&JSON.stringify([...chartCampaigns(other)].sort((a,b)=>a-b))===ids);
}
function sharedPeriodMax(card){
 const related=comparablePeriodCards(card);if(related.length<2)return 0;
 let maximum=0;
 for(const relatedCard of related){
  const relatedRows=rows(relatedCard),ids=chartCampaigns(relatedCard);
  if(relatedCard.group==='campaign')maximum=Math.max(maximum,...ids.map(i=>aggregate(relatedRows.filter(row=>row.i===i),relatedCard.metric)||0));
  else maximum=Math.max(maximum,...[...new Set(relatedRows.map(row=>row.day))].flatMap(day=>ids.map(i=>aggregate(relatedRows.filter(row=>row.i===i&&row.day===day),relatedCard.metric)||0)));
 }
 return maximum;
}
function tooltip(label,value,period,metric){return `<desc data-tip-name="${escapeLabel(label)}" data-tip-value="${escapeLabel(value)}" data-tip-date="${escapeLabel(period)}" data-tip-metric="${escapeLabel(metric)}">${escapeLabel(label)}: ${escapeLabel(value)}</desc>`}
function basePlot(c,size={}){if(['kpi','funnel','scatter','table'].includes(c.type))return extraPlot(c,size);if(c.group==='hour')return '<div class="empty-chart">— A fonte desta prévia fornece dados diários. Evolução por hora ainda indisponível.</div>'; const formatDate=value=>date(value.slice(0,10)).toLocaleDateString('pt-BR',{timeZone:'UTC'})+(value.includes('T')?' · '+value.slice(11)+' (Brasília)':'');const axisDate=value=>value.includes('T')?value.slice(11):short(value);const [from,to]=range(c);const period=from===to?formatDate(from):formatDate(from)+' – '+formatDate(to);const tip=(label,value,day,metric=metricLabels[c.metric])=>tooltip(label,value,day?formatDate(day):period,metric);const selected=chartCampaigns(c),rs=c.group==='hour'?hourlyRows(rows(c)):rows(c);if(!rs.length)return '<div class="empty-chart">Sem dados para os filtros selecionados.</div>';let points=c.group==='campaign'?selected.map(i=>({label:campaigns[i].name,color:campaigns[i].color,value:aggregate(rs.filter(r=>r.i===i),c.metric)})):[...new Set(rs.map(r=>r.day))].map(day=>({day,label:axisDate(day),color:'#347be0',value:aggregate(rs.filter(r=>r.day===day),c.metric)}));let svg='',W=['radar','donut'].includes(c.type)?560:(size.width||560),H=['radar','donut'].includes(c.type)?220:(size.height||220),L=62,R=26,T=24,B=30,w=W-L-R,h=H-T-B,max=Math.max(sharedPeriodMax(c),previousChartMax(c),...points.map(p=>p.value),...selected.map(i=>referenceFor(campaigns[i],c.metric)||0),1)*1.18;
const font=Math.max(10,Math.min(18,12+(W-280)/110+(H-220)/160));
L=Math.max(34,measureLabel(max.toLocaleString('pt-BR',{maximumFractionDigits:1}),font)+10);R=10;w=W-L-R;
const labelLines=Math.max(2,Math.floor((H*.25-12)/(font+3)));
const labels=points.map(p=>wrapChartLabel(p.label,w/points.length-6,font,labelLines));
B=c.group==='campaign'?Math.max(30,Math.max(...labels.map(a=>a.length))*(font+3)+12):30;h=Math.max(40,H-T-B);
const unit=c.metric==='results'?integration.resultName:c.metric==='ctr'?'%':'R$';
if(['day','hour'].includes(c.group)&&['line','area'].includes(c.type)){
 const days=[...new Set(rs.map(r=>r.day))];
 const series=selected.map(i=>({i,values:days.map(day=>aggregate(rs.filter(r=>r.i===i&&r.day===day),c.metric))}));
 max=Math.max(1,sharedPeriodMax(c),previousChartMax(c),...series.flatMap(s=>s.values),...selected.map(i=>referenceFor(campaigns[i],c.metric)||0))*1.18;
 const x=j=>L+(days.length===1?w/2:j*w/(days.length-1)),y=v=>T+h-v/max*h;
 for(let j=0;j<=4;j++)svg+=`<line class="grid" x1="${L}" x2="${W-R}" y1="${y(max*j/4)}" y2="${y(max*j/4)}"/><text x="${L-8}" y="${y(max*j/4)+4}" text-anchor="end">${(max*j/4).toLocaleString('pt-BR',{maximumFractionDigits:1})}</text>`;
 svg+=`<text x="${L}" y="10">${unit}</text>`;
 const tickStep=Math.max(1,Math.ceil((days.length-1)/Math.max(1,Math.floor(w/64))));
 days.forEach((day,j)=>{if((j%tickStep===0&&days.length-1-j>=tickStep)||j===days.length-1)svg+=`<text x="${x(j)}" y="${H-12}" text-anchor="middle">${axisDate(day)}</text>`});
 series.forEach(s=>{const color=campaigns[s.i].color,pts=s.values.map((v,j)=>`${x(j)},${y(v)}`).join(' ');if(c.type==='area')svg+=`<polygon points="${x(0)},${T+h} ${pts} ${x(days.length-1)},${T+h}" fill="${color}" opacity=".08"/>`;svg+=`<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5"/>`;s.values.forEach((v,j)=>svg+=`<circle cx="${x(j)}" cy="${y(v)}" r="4" fill="${color}" stroke="white">${tip(campaigns[s.i].name,fmt(v,c.metric),days[j])}</circle>`)});
 return `<svg style="--plot-font:${['radar','donut'].includes(c.type)?14:font}px" viewBox="0 0 ${W} ${H}" role="img" aria-label="${metricLabels[c.metric]} por dia e campanha">${svg}</svg>`;
}
if(c.type==='radar'){const cx=280,cy=105,rad=78,axes=Object.keys(metrics);let pol=(values)=>values.map((v,j)=>{let a=j*Math.PI/3-Math.PI/2;return `${cx+Math.cos(a)*rad*v},${cy+Math.sin(a)*rad*v}`}).join(' ');for(let f of [.25,.5,.75,1])svg+=`<polygon points="${pol(axes.map(()=>f))}" fill="none" stroke="#dce6ee"/>`;axes.forEach((m,j)=>{let a=j*Math.PI/3-Math.PI/2;svg+=`<text x="${cx+Math.cos(a)*108}" y="${cy+Math.sin(a)*96+4}" text-anchor="middle">${metrics[m]}</text>`});const values=selected.map(i=>axes.map(m=>aggregate(rs.filter(r=>r.i===i),m)));selected.forEach((i,k)=>{let scores=values[k].map((v,j)=>{let all=values.map(x=>x[j]),lo=Math.min(...all),hi=Math.max(...all);if(hi===lo)return .5;return ['cpl','cpc','cpm'].includes(axes[j])?1-(v-lo)/(hi-lo):(v-lo)/(hi-lo)});svg+=`<polygon points="${pol(scores)}" stroke="${campaigns[i].color}" fill="${campaigns[i].color}" fill-opacity=".12" stroke-width="2">${tip(campaigns[i].name,'perfil relativo às campanhas selecionadas')}</polygon>`;scores.forEach((v,j)=>{let a=j*Math.PI/3-Math.PI/2;svg+=`<circle cx="${cx+Math.cos(a)*rad*v}" cy="${cy+Math.sin(a)*rad*v}" r="4" fill="${campaigns[i].color}">${tip(campaigns[i].name,fmt(values[k][j],axes[j]),null,metricLabels[axes[j]])}</circle>`})});svg+='<text x="280" y="218" text-anchor="middle">0–100 relativo · custos invertidos · até 4 campanhas</text>'}
else if(c.type==='donut'){const total=points.reduce((a,p)=>a+p.value,0);let off=0;points.forEach(p=>{let len=total?p.value/total*502.65:0;svg+=`<circle cx="280" cy="105" r="80" fill="none" stroke="${p.color}" stroke-width="30" stroke-dasharray="${len} ${502.65-len}" stroke-dashoffset="${-off}" transform="rotate(-90 280 105)">${tip(p.day?selected.map(i=>campaigns[i].name).join(' · '):p.label,fmt(p.value,c.metric),p.day)}</circle>`;off+=len});svg+=`<text x="280" y="102" text-anchor="middle">Total</text><text x="280" y="126" text-anchor="middle" style="font-size:22px;font-weight:700">${tip("Total",fmt(total,c.metric))}${chartValue(total,c.metric,Math.min(150,(size.width||560)*.32),14,true)}</text>`}
else if(c.type==='horizontal'){const labelWidth=Math.min(Math.max(98,W*.28),Math.max(...points.map(p=>measureLabel(p.label,font))));const barStart=labelWidth+17,valueWidth=Math.min(W*.3,Math.max(...points.map(p=>measureLabel(fmt(p.value,c.metric),font)))+8),barWidth=Math.max(30,W-barStart-valueWidth-14),rowHeight=Math.max(24,(H-8)/points.length),barHeight=Math.max(8,Math.min(24,rowHeight*.55)),contentHeight=rowHeight*points.length,startY=Math.max(4,(H-contentHeight)/2);points.forEach((p,i)=>{let y=startY+i*rowHeight+(rowHeight-barHeight)/2,textY=y+barHeight/2+font*.35;svg+=`<text x="${labelWidth+7}" y="${textY}" text-anchor="end">${tip(p.day?selected.map(i=>campaigns[i].name).join(' · '):p.label,fmt(p.value,c.metric),p.day)}${escapeLabel(shortenChartLabel(p.label,labelWidth,font))}</text><rect x="${barStart}" y="${y}" width="${p.value/max*barWidth}" height="${barHeight}" rx="3" fill="${p.color}">${tip(p.day?selected.map(i=>campaigns[i].name).join(' · '):p.label,fmt(p.value,c.metric),p.day)}</rect><text x="${barStart+7+p.value/max*barWidth}" y="${textY}" aria-label="${escapeLabel(fmt(p.value,c.metric))}">${tip(p.day?selected.map(i=>campaigns[i].name).join(' · '):p.label,fmt(p.value,c.metric),p.day)}${chartValue(p.value,c.metric,W-(barStart+7+p.value/max*barWidth)-6,font,true)}</text>`})}
else{for(let j=0;j<=4;j++){let y=T+h-j*h/4;svg+=`<line class="grid" x1="${L}" x2="${W-R}" y1="${y}" y2="${y}"/><text x="${L-8}" y="${y+4}" text-anchor="end">${(max*j/4).toLocaleString('pt-BR',{maximumFractionDigits:1})}</text>`}svg+=`<text x="${L}" y="10">${unit}</text>`;const bw=w/points.length;points.forEach((p,i)=>{let x=L+bw*(i+.5),y=T+h-p.value/max*h;if(c.type==='bars')svg+=`<rect x="${x-bw*.27}" y="${y}" width="${bw*.54}" height="${T+h-y}" rx="3" fill="${p.color}">${tip(p.day?selected.map(i=>campaigns[i].name).join(' · '):p.label,fmt(p.value,c.metric),p.day)}</rect>`;if(points.length<=8||i%Math.ceil(points.length/7)===0)svg+=`<text x="${x}" y="${T+h+font+10}" text-anchor="middle" aria-label="${escapeLabel(p.label)}">${tip(p.day?selected.map(i=>campaigns[i].name).join(' · '):p.label,fmt(p.value,c.metric),p.day)}${labels[i].map((line,j)=>`<tspan x="${x}" dy="${j?font+3:0}">${escapeLabel(line)}</tspan>`).join('')}</text>`;if(c.type==='bars')svg+=`<text x="${x}" y="${y-6}" text-anchor="middle" aria-label="${escapeLabel(fmt(p.value,c.metric))}">${tip(p.day?selected.map(i=>campaigns[i].name).join(' · '):p.label,fmt(p.value,c.metric),p.day)}${chartValue(p.value,c.metric,bw-6,font,true)}</text>`});if(c.type==='line'||c.type==='area'){let pts=points.map((p,i)=>`${L+bw*(i+.5)},${T+h-p.value/max*h}`);if(c.type==='area')svg+=`<polygon points="${L+bw*.5},${T+h} ${pts.join(' ')} ${L+bw*(points.length-.5)},${T+h}" fill="#347be0" opacity=".13"/>`;svg+=`<polyline points="${pts.join(' ')}" fill="none" stroke="#347be0" stroke-width="2.5"/>`;points.forEach((p,i)=>svg+=`<circle cx="${L+bw*(i+.5)}" cy="${T+h-p.value/max*h}" r="5" fill="#347be0" stroke="white" stroke-width="2">${tip(p.day?selected.map(i=>campaigns[i].name).join(' · '):p.label,fmt(p.value,c.metric),p.day)}</circle>`)}}
return `<svg style="--plot-font:${['radar','donut'].includes(c.type)?14:font}px" viewBox="0 0 ${W} ${H}" role="img" aria-label="${metricLabels[c.metric]} · ${types[c.type]}">${svg}</svg>`}
function fixedChartDescription(type){return {table:integration.view.startsWith('micro')?(integration.view==='micro-ads'?'Tabela de anúncios e indicadores':'Tabela de conjuntos de anúncios e indicadores'):'Tabela de campanhas e indicadores',funnel:'Etapas de conversão',scatter:'Investimento × resultados',radar:'Perfil de seis métricas'}[type]||null;}
function chartMetricControl(c){
 const fixed=fixedChartDescription(c.type);
 if(fixed)return `<div class="chart-filter-field">Análise<span class="fixed-chart-analysis">${fixed}</span>${c.type==='funnel'?'<small>Para comparar investimento, use Colunas, Barras ou Linhas.</small>':''}</div>`;
 const allowed=c.type==='donut'?Object.fromEntries(Object.entries(metricLabels).filter(([key])=>['spend','results'].includes(key))):metricLabels;
 return `<label class="chart-filter-field">Métrica<select data-field="metric" aria-label="Métrica">${options(allowed,c.metric)}</select></label>`;
}
function cardHTML(c,expanded=false){const selected=chartCampaigns(c);let [a,b]=range(c),title=chartTitle(c);return `<article class="card ${c.type==='funnel'&&selected.length<=9?'funnel-all-visible':''}" data-id="${c.id}" data-chart-type="${c.type}" style="--span:${c.span};--height:${c.height}px;--rows:${Math.ceil((c.height+16)/20)}"><div class="card-top"><button class="icon group-select" data-group-select="${c.id}" aria-label="Selecionar gráfico para mover em grupo" aria-pressed="${groupSelection.has(c.id)}">✓</button><button class="icon handle"  title="Arrastar gráfico" aria-label="Mover ${title}">⠿</button><div class="metric-heading"><h2 title="${escapeLabel(title)}">${title}</h2><button class="metric-info" data-metric-info="${c.type==='radar'?'radar':c.metric}" aria-label="Entender ${title}" title="Como interpretar esta métrica">ⓘ</button></div><button class="icon filter-toggle" data-action="filters" title="Filtros do gráfico" aria-label="Filtros do gráfico" aria-expanded="false"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 5h16l-6 7v6l-4 2v-8z"/></svg></button><button class="icon" data-action="type" title="Trocar modelo" aria-label="Trocar modelo do gráfico">▥</button>${!expanded?'<button class="icon" data-action="expand" title="Expandir gráfico" aria-label="Expandir gráfico">⤢</button>':''}<button class="icon" data-action="menu" title="Opções do gráfico" aria-label="Opções do gráfico">⋯</button></div><div class="subtitle">${c.group==='campaign'?(integration.view.startsWith('micro')?'Comparação entre conjuntos/anúncios':'Comparação por campanha'):c.group==='hour'?'Evolução por hora · Simulação · Brasília':'Evolução diária'} · ${short(a)} – ${short(b)} · ${Array.isArray(c.campaignIds)?selected.length+' campanhas próprias':'Campanhas gerais'}</div><div class="card-controls" hidden><div class="chart-filter-header"><strong>Filtros do gráfico</strong><button class="icon" data-action="filters" aria-label="Fechar filtros">×</button></div>${chartMetricControl(c)}<label class="chart-filter-field">Período<select data-field="period" aria-label="Período do gráfico">${options({global:'Período geral',today:'Hoje',week:'Esta semana',month:'Este mês',custom:'Personalizado'},c.period)}</select></label><label class="chart-filter-field" ${fixedChartDescription(c.type)||c.type==='kpi'?'hidden':''}>Agrupar por<select data-field="group" aria-label="Agrupamento">${options({campaign:'Por campanha',day:'Por dia',hour:'Por hora'},c.group)}</select></label>${c.period==='custom'?`<input data-field="start" aria-label="Início do gráfico" type="date"  value="${c.start}"><input data-field="end" aria-label="Fim do gráfico" type="date"  value="${c.end}">`:''}${campaignControls(c)}</div><div class="chart">${plot(c)}</div><div class="legend">${selected.map(i=>`<span title="${escapeLabel(campaigns[i].name)}"><i style="background:${campaigns[i].color}"></i>${campaigns[i].name}</span>`).join('')}</div><button class="resize" aria-label="Redimensionar gráfico" title="Arraste para redimensionar">◢</button></article>`}
function chartSignature(card){
 const normalized={...card};normalize(normalized);
 // Relative periods stay distinct even when their dates temporarily coincide.
 const period=[normalized.period,...(['custom','global'].includes(normalized.period)?range(normalized):[])];
 return JSON.stringify([normalized.type,normalized.metric,normalized.group,period,[...new Set(chartCampaigns(normalized))].sort((a,b)=>a-b)]);
}
function existingChart(card){
 return cards.find(other=>other.id!==card.id&&chartSignature(other)===chartSignature(card));
}
function showExistingChart(existing){
 for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
 closeChartFilters();
 document.querySelectorAll('.menu').forEach(menu=>menu.remove());
 toast('Este gráfico já existe. Ele foi destacado; nenhum gráfico foi removido.');
 const element=[...$('#canvas').querySelectorAll('.card')].find(card=>card.dataset.id===existing.id);
 if(!element)return;
 document.querySelectorAll('.duplicate-highlight').forEach(card=>card.classList.remove('duplicate-highlight'));
 element.classList.add('duplicate-highlight');element.tabIndex=-1;
 element.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'center'});
 element.focus({preventScroll:true});
 clearTimeout(showExistingChart.timer);showExistingChart.timer=setTimeout(()=>element.classList.remove('duplicate-highlight'),5000);
}
function rejectDuplicate(candidate){const existing=existingChart(candidate);if(!existing)return false;showExistingChart(existing);return true;}
let chartFitFrame=0;
function fitRenderedCharts(){
 cancelAnimationFrame(chartFitFrame);
 chartFitFrame=requestAnimationFrame(()=>{
  $('#canvas').querySelectorAll('.card').forEach(element=>{
   const card=cards.find(item=>item.id===element.dataset.id);
   if(!card||!['bars','horizontal','line','area','scatter'].includes(card.type))return;
   const chart=$('.chart',element);if(!chart)return;
   const style=getComputedStyle(chart);
   const width=Math.max(180,chart.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight));
   const reserved=(comparablePeriodCards(card).length>1?18:0)+(chart.querySelector('.cap-reference')?18:0);
   const height=Math.max(card.type==='horizontal'?34:86,chart.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)-reserved);
   chart.innerHTML=plot(card,{width:Math.round(width),height:Math.round(height)});
  });
 });
}
function showDuplicatePeriods(menu,c){
 const labels={global:'Período geral',today:'Hoje',week:'Esta semana',month:'Este mês',custom:'Personalizado'};
 menu.classList.add('duplicate-period-menu');
 menu.innerHTML='<strong>Duplicar gráfico</strong><small>Escolha outro período para criar a cópia.</small>'+Object.entries(labels).filter(([period])=>period!==c.period).map(([period,label])=>`<button data-duplicate-period="${period}">${label}</button>`).join('');
 toast('Para duplicar, escolha um período diferente.');
 menu.onclick=event=>{
  const period=event.target.dataset.duplicatePeriod;if(!period)return;
  const copy={...c,id:uid(),period};
  if(period==='custom'){copy.start=integration.range.start;copy.end=integration.range.end;}
  normalize(copy);
  const duplicate=existingChart(copy);
  if(duplicate){showExistingChart(duplicate);toast('Já existe um gráfico igual nesse período. Escolha outro período.');return;}
  checkpoint();cards.splice(cards.indexOf(c)+1,0,copy);render();
  const element=[...$('#canvas').querySelectorAll('.card')].find(card=>card.dataset.id===copy.id);
  if(element){$('.card-controls',element).hidden=false;$('.filter-toggle',element).setAttribute('aria-expanded','true');element.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'center'});}
  toast(`Gráfico duplicado para ${labels[period]}.`);
 };
}
function render(animate=true){const before=layoutSnapshot();cards.forEach(c=>{normalize(c);c.height=Math.max(cardMinHeight(c),Math.min(724,Math.round((c.height+16)/20)*20-16));c.span=Math.max(2,Math.min(12,Math.round((c.span||6)*5)/5))});document.body.classList.toggle('editing',editing);$('#canvas').innerHTML=cards.map(c=>cardHTML(c)).join('');$('#count').textContent=`${cards.length} gráficos${editing?' · Arraste pelo ⠿ e redimensione pelo canto inferior direito':''}`;$('#profiles').textContent='Perfis · '+activeProfile().name;$('#empty').hidden=cards.length>0;selectEditableCard(activeCardId);packCanvas();fitRenderedCharts();updateGroupToolbar();if(animate)animateLayout(before);persist();updateHistoryButtons()}
function normalize(c){if(c.type==='table'){c.metric='results';c.group='campaign';}if(c.type==='funnel')c.metric='results';if(c.type==='scatter')c.metric='spend';if(c.type==='radar')c.metric='ctr';if(c.type==='donut'&&(!['spend','results'].includes(c.metric)||c.group!=='campaign'))c.type='bars';if(['radar','funnel','scatter','kpi'].includes(c.type))c.group='campaign'}
document.addEventListener('click',e=>{if(!e.target.closest('.menu')&&!e.target.closest('[data-action]'))document.querySelectorAll('.menu').forEach(m=>m.remove());let b=e.target.closest('[data-action]');if(!b)return;let el=b.closest('.card'),c=cards.find(x=>x.id===el.dataset.id);if(!c)return;let action=b.dataset.action;if(action==='filters'){const panel=$('.card-controls',el),opening=panel.hidden;closeChartFilters();panel.hidden=!opening;b.setAttribute('aria-expanded',String(opening));return}closeChartFilters();document.querySelectorAll('.menu').forEach(m=>m.remove());if(action==='expand'){$('#expanded-title').textContent=chartTitle(c);$('#expanded-content').innerHTML=cardHTML(c,true);$('#expanded').showModal();return}let menu=document.createElement('div');menu.className='menu';if(action==='type'){menu.innerHTML=Object.entries(types).filter(([t])=>t!=='donut'||(['spend','results'].includes(c.metric)&&c.group==='campaign')).map(([t,n])=>`<button data-type="${t}" aria-pressed="${c.type===t}">${n}${c.type===t?' ✓':''}</button>`).join('');menu.onclick=ev=>{let t=ev.target.dataset.type;if(!t)return;const candidate={...c,type:t};normalize(candidate);if(rejectDuplicate(candidate))return;checkpoint();Object.assign(c,candidate);refresh()}}else{menu.innerHTML='<button data-op="duplicate">Duplicar gráfico</button><button data-size="4">Largura: ⅓ da tela</button><button data-size="6">Largura: ½ da tela</button><button data-size="12">Largura: tela inteira</button><button data-op="up">Mover para antes</button><button data-op="down">Mover para depois</button><button data-op="remove">Remover gráfico</button>';menu.onclick=ev=>{ev.stopPropagation();let size=ev.target.dataset.size,op=ev.target.dataset.op;if(!size&&!op)return;if(op==='duplicate'){showDuplicatePeriods(menu,c);return;}checkpoint();let idx=cards.indexOf(c);if(size)c.span=+size;if(op==='remove'){cards.splice(idx,1);toast('Gráfico removido. Use Desfazer para recuperar.')}if(op==='up'&&idx>0)[cards[idx-1],cards[idx]]=[cards[idx],cards[idx-1]];if(op==='down'&&idx<cards.length-1)[cards[idx+1],cards[idx]]=[cards[idx],cards[idx+1]];refresh()}}el.append(menu)});
function refresh(){let id=$('#expanded-content .card')?.dataset.id;render();if($('#expanded').open){let c=cards.find(c=>c.id===id);if(c){$('#expanded-title').textContent=chartTitle(c);$('#expanded-content').innerHTML=cardHTML(c,true);}else $('#expanded').close()}}
document.addEventListener('change',e=>{let field=e.target.dataset.field;if(!field)return;const expanded=!!e.target.closest('#expanded');let c=cards.find(c=>c.id===e.target.closest('.card').dataset.id);const candidate={...c,[field]:e.target.value};normalize(candidate);if(existingChart(candidate)){e.target.value=c[field];showExistingChart(existingChart(candidate));return;}checkpoint();Object.assign(c,candidate);refresh();const host=expanded?$('#expanded-content'):$('#canvas');const card=[...host.querySelectorAll('.card')].find(el=>el.dataset.id===c.id);if(card){$('.card-controls',card).hidden=false;$('.filter-toggle',card).setAttribute('aria-expanded','true')}});
$('#undo').onclick=()=>{if(history.length){future.push(JSON.stringify(cards));cards=JSON.parse(history.pop());refresh()}};$('#redo').onclick=()=>{if(future.length){history.push(JSON.stringify(cards));cards=JSON.parse(future.pop());refresh()}};$('#reset').onclick=()=>{const standard=profileState.items.find(item=>item.id===profileState.defaultId);if(standard&&confirm(`Restaurar o perfil padrão “${standard.name}”? Você poderá desfazer.`)){checkpoint();cards=cloneCards(standard.cards);render()}};$('#collapse').onclick=()=>{document.body.classList.toggle('collapsed');$('#collapse').textContent=document.body.classList.contains('collapsed')?'›':'‹'};
function renderProfileDialog(){
 $('#profile-list').innerHTML=profileState.items.map(item=>`<article class="profile-row" data-profile-row="${item.id}"><input maxlength="40" value="${escapeLabel(item.name)}" aria-label="Nome do perfil ${escapeLabel(item.name)}"><small>${item.id===profileState.activeId?'Em uso':''}${item.id===profileState.defaultId?(item.id===profileState.activeId?' · ':'')+'Padrão':''}</small><button type="button" data-profile-open="${item.id}" ${item.id===profileState.activeId?'disabled':''}>Abrir</button><button type="button" data-profile-rename="${item.id}">Salvar nome</button><button type="button" data-profile-default="${item.id}" ${item.id===profileState.defaultId?'disabled':''}>Tornar padrão</button><button type="button" data-profile-delete="${item.id}" ${profileState.items.length===1||item.id===profileState.defaultId?'disabled':''}>Excluir</button></article>`).join('');
}
$('#profiles').onclick=()=>{renderProfileDialog();$('#profiles-dialog').showModal();};
$('#create-profile').onclick=()=>{const input=$('#new-profile-name'),name=input.value.trim();if(!name){input.focus();return;}const id=uid();profileState.items.push({id,name,cards:cloneCards(cards)});profileState.activeId=id;saveProfiles();input.value='';history=[];future=[];renderProfileDialog();render();toast(`Perfil “${name}” criado e ativado.`);};
$('#profile-list').onclick=event=>{
 const button=event.target.closest('button');if(!button)return;
 const id=button.dataset.profileOpen||button.dataset.profileRename||button.dataset.profileDefault||button.dataset.profileDelete;
 const item=profileState.items.find(profile=>profile.id===id);if(!item)return;
 if(button.dataset.profileOpen){profileState.activeId=id;cards=cloneCards(item.cards);history=[];future=[];saveProfiles();renderProfileDialog();render();toast(`Perfil “${item.name}” aberto.`);return;}
 if(button.dataset.profileRename){const input=button.closest('[data-profile-row]').querySelector('input'),name=input.value.trim();if(!name){input.focus();return;}item.name=name;saveProfiles();renderProfileDialog();render();toast('Perfil renomeado.');return;}
 if(button.dataset.profileDefault){profileState.defaultId=id;saveProfiles();renderProfileDialog();toast(`“${item.name}” definido como padrão.`);return;}
 if(button.dataset.profileDelete&&confirm(`Excluir o perfil “${item.name}”?`)){profileState.items=profileState.items.filter(profile=>profile.id!==id);if(profileState.activeId===id){const next=profileState.items.find(profile=>profile.id===profileState.defaultId)||profileState.items[0];profileState.activeId=next.id;cards=cloneCards(next.cards);}saveProfiles();renderProfileDialog();render();toast('Perfil excluído.');}
};
$('#campaign-options').innerHTML=`<label><input type="checkbox" id="all" checked>Selecionar todas</label>`+campaigns.map((c,i)=>`<label><input type="checkbox" value="${i}" checked><span style="color:${c.color}">●</span>${c.name}</label>`).join('');$('#campaign-options').onchange=e=>{if(e.target.id==='all')$('#campaign-options').querySelectorAll('input').forEach(x=>x.checked=e.target.checked);selected=[...$('#campaign-options').querySelectorAll('input:not(#all):checked')].map(x=>+x.value);$('#all').checked=selected.length===campaigns.length;$('#all').indeterminate=selected.length>0&&selected.length<4;$('#campaigns summary').textContent=`Campanhas · ${selected.length} selecionadas`;render()};document.addEventListener('click',e=>{if(!e.target.closest('#campaigns'))$('#campaigns').open=false});
$('#period').onchange=()=>{let r=range({period:$('#period').value,start:$('#start').value,end:$('#end').value});$('#start').value=r[0];$('#end').value=r[1];render()};for(let id of ['start','end'])$('#'+id).onchange=()=>{if($('#start').value>$('#end').value){toast('O início deve ser anterior ao fim.');return}$('#period').value='custom';render()};
const library=[{name:'Funis comparativos',metric:'results',type:'funnel',period:'global',group:'campaign',description:'Compare etapas; campos sem dados aparecem como —'},{name:'Indicador · nome e valor',metric:'spend',type:'kpi',period:'global',group:'campaign',description:'Card simples com métrica e valor'},{name:'Investimento × resultados',metric:'spend',type:'scatter',period:'global',group:'campaign',description:'Compare gasto e retorno das campanhas'},...Object.entries(metricLabels).map(([metric,name])=>({name,metric,type:'bars',period:'global',group:'campaign',description:'Compare as campanhas lado a lado'})),{name:'Gastos de hoje',metric:'spend',type:'bars',period:'today',group:'campaign',description:'Investimento por campanha no dia'},{name:'Evolução de hoje',metric:'spend',type:'line',period:'today',group:'hour',description:'Por hora · exige dados horários da fonte'},{name:'Evolução da semana',metric:'spend',type:'line',period:'week',group:'day',description:'Gasto diário nesta semana'},{name:'Evolução do mês',metric:'spend',type:'area',period:'month',group:'day',description:'Gasto diário no mês corrente'},{name:'Período personalizado',metric:'spend',type:'line',period:'custom',group:'day',description:'Escolha início, fim e métrica'},{name:'Perfil radar',metric:'ctr',type:'radar',period:'global',group:'campaign',description:'Até 4 campanhas · escala relativa 0–100'}];$('#library-items').innerHTML=library.map((x,i)=>`<button data-template="${i}"><b>${x.name}</b><small>${x.description}</small></button>`).join('');$('#add').onclick=()=>$('#library').showModal();$('#library-items').onclick=e=>{let b=e.target.closest('[data-template]');if(!b)return;checkpoint();cards.push({...library[+b.dataset.template],id:uid(),span:6,height:380,start:integration.range.start,end:integration.range.end});$('#library').close();render();$('#canvas').lastElementChild.scrollIntoView({behavior:'smooth',block:'center'});toast('Gráfico adicionado')};document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('#canvas').addEventListener('dragstart',e=>{if(!editing||!e.target.closest('.handle'))return e.preventDefault();dragId=e.target.closest('.card').dataset.id;e.dataTransfer.setData('text/plain',dragId);e.target.closest('.card').classList.add('dragging')});$('#canvas').addEventListener('dragover',e=>{if(!dragId)return;e.preventDefault()});$('#canvas').addEventListener('drop',e=>{e.preventDefault();let target=e.target.closest('.card');if(!target||target.dataset.id===dragId)return;checkpoint();let from=cards.findIndex(c=>c.id===dragId),to=cards.findIndex(c=>c.id===target.dataset.id);cards.splice(to,0,cards.splice(from,1)[0]);dragId=null;render()});$('#canvas').addEventListener('dragend',()=>{dragId=null;document.querySelectorAll('.dragging').forEach(x=>x.classList.remove('dragging'))});
$('#canvas').addEventListener('pointerdown',e=>{
 if(!e.target.closest('.resize')||(!editing&&e.target.closest('.card')?.dataset.id!==activeCardId))return;e.preventDefault();
 const el=e.target.closest('.card'),c=cards.find(x=>x.id===el.dataset.id),x=e.clientX,y=e.clientY,width=el.getBoundingClientRect().width,height=el.getBoundingClientRect().height,initial={span:c.span,height:c.height},pitch=canvasPitch();
 const beforeState=JSON.stringify(cards);e.target.setPointerCapture(e.pointerId);el.classList.add('resizing');
 const move=ev=>{const before=layoutSnapshot();c.span=matchMedia('(max-width:700px)').matches?initial.span:Math.max(2,Math.min(12,Math.round((width+ev.clientX-x+16)/pitch*5)/5));c.height=Math.max(cardMinHeight(c),Math.min(724,Math.round((height+ev.clientY-y+16)/20)*20-16));packCanvas(c.id);fitRenderedCharts();animateLayout(before,c.id)};
 const finish=cancel=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',cancelResize);window.removeEventListener('keydown',escapeResize);if(cancel)cards=JSON.parse(beforeState);else if(JSON.stringify(cards)!==beforeState)recordChange(beforeState);render()};
 const end=()=>finish(false),cancelResize=()=>finish(true),escapeResize=ev=>{if(ev.key==='Escape')finish(true)};
 window.addEventListener('pointermove',move);window.addEventListener('pointerup',end,{once:true});window.addEventListener('pointercancel',cancelResize,{once:true});window.addEventListener('keydown',escapeResize);
});
function startCardDrag(e){
 e.preventDefault();closeChartFilters();
 const canvas=$('#canvas'),el=e.target.closest('.card'),id=el.dataset.id,startX=e.clientX,startY=e.clientY;
 const dragIds=groupSelection.has(id)&&groupSelection.size>1?[...groupSelection]:[id];
 const dragSet=new Set(dragIds),dragCards=cards.filter(card=>dragSet.has(card.id));
 const dragElements=dragIds.map(dragId=>[...canvas.children].find(card=>card.dataset.id===dragId)).filter(Boolean);
 const origins=new Map(dragElements.map(card=>[card.dataset.id,card.getBoundingClientRect()]));
 const groups=[];for(const card of canvas.children){const top=card.offsetTop;let group=groups.find(g=>g.top===top);if(!group){const rect=card.getBoundingClientRect();group={top,y:rect.top,bottom:rect.bottom,items:[]};groups.push(group);}group.items.push({id:card.dataset.id,rect:card.getBoundingClientRect()});}
 const original=cards.map(c=>({...c}));let moved=false,proposal=null,signature='',slots=[];
 const groupRemains=group=>group.items.some(item=>!dragSet.has(item.id));
 const remainingRowIndex=sourceIndex=>groups.slice(0,sourceIndex).filter(groupRemains).length;
 const candidate=ev=>{
  const bounds=canvas.getBoundingClientRect();if(ev.clientX<bounds.left||ev.clientX>bounds.right||ev.clientY<bounds.top-24||ev.clientY>bounds.bottom+120)return null;
  const first=groups[0],last=groups.at(-1);
  if(ev.clientY<first.y)return {mode:'row',insertAt:0};
  if(ev.clientY>last.bottom)return {mode:'row',insertAt:groups.filter(groupRemains).length};
  let rowIndex=groups.findIndex(g=>ev.clientY>=g.y-8&&ev.clientY<=g.bottom+8);
  if(rowIndex<0){
   const nextIndex=groups.findIndex(g=>ev.clientY<g.y);
   return {mode:'row',insertAt:nextIndex<0?groups.filter(groupRemains).length:remainingRowIndex(nextIndex)};
  }
  const row=groups[rowIndex],height=Math.max(1,row.bottom-row.y),edge=Math.min(36,height*.12);
  if(ev.clientY-row.y<=edge)return {mode:'row',insertAt:remainingRowIndex(rowIndex)};
  if(row.bottom-ev.clientY<=edge)return {mode:'row',insertAt:remainingRowIndex(rowIndex)+(groupRemains(row)?1:0)};
  const rowItems=groups[rowIndex].items.filter(item=>!dragSet.has(item.id));if(rowItems.length+dragIds.length>6)return null;
  let index=rowItems.findIndex(item=>ev.clientX<item.rect.left+item.rect.width/2);if(index<0)index=rowItems.length;
  return {mode:'cell',rowIndex:remainingRowIndex(rowIndex),index};
 };
 const preview=destination=>{
  const key=destination?destination.mode+':'+destination.rowIndex+':'+destination.insertAt+':'+destination.index:'none';if(key===signature)return;signature=key;
  const before=layoutSnapshot();
  if(destination){
   const rows=groups.map(g=>g.items.map(item=>original.find(c=>c.id===item.id)).filter(c=>c&&!dragSet.has(c.id)));
   const compactRows=rows.filter(row=>row.length),moving=dragCards.map(card=>original.find(c=>c.id===card.id));
   if(destination.mode==='row')compactRows.splice(destination.insertAt,0,moving);
   else compactRows[destination.rowIndex].splice(destination.index,0,...moving);
   proposal=compactRows.flatMap(row=>row.map(c=>({...c,span:12/row.length})));
  }else proposal=null;
  let slotIndex=0;
  packCanvas(null,(proposal||original).map(c=>dragSet.has(c.id)?{...c,id:'drag-slot-'+slotIndex++}:c));
  animateLayout(before,id);
 };
 const move=ev=>{
  if(Math.hypot(ev.clientX-startX,ev.clientY-startY)>5)moved=true;if(!moved)return;
  if(!slots.length){
   dragElements.forEach((card,index)=>{const origin=origins.get(card.dataset.id);card.getAnimations().forEach(a=>a.cancel());card.style.position='fixed';card.style.left=origin.left+'px';card.style.top=origin.top+'px';card.style.setProperty('width',origin.width+'px','important');card.style.setProperty('height',origin.height+'px','important');card.style.zIndex=String(50+index);card.style.pointerEvents='none';card.classList.add('dragging');const slot=document.createElement('article');slot.className='card drop-slot';slot.dataset.id='drag-slot-'+index;slot.innerHTML=index===0?'<span>＋</span><strong>Solte o grupo aqui</strong>':'';canvas.append(slot);slots.push(slot);});
   document.body.classList.add('canvas-dragging');
  }
  dragElements.forEach(card=>card.style.transform=`translate3d(${ev.clientX-startX}px,${ev.clientY-startY}px,0)`);
  preview(candidate(ev));
 };
 const finish=(ev,cancel=false)=>{
  window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',cancelDrag);window.removeEventListener('keydown',escapeDrag);
  if(moved&&!cancel)preview(candidate(ev));
  const before=layoutSnapshot();document.body.classList.remove('canvas-dragging');
  if(!cancel&&proposal&&JSON.stringify(proposal)!==JSON.stringify(cards)){checkpoint();cards=proposal;}
  render(false);if(moved)animateLayout(before);
 };
 const end=ev=>finish(ev),cancelDrag=ev=>finish(ev,true),escapeDrag=ev=>{if(ev.key==='Escape')finish(ev,true)};
 window.addEventListener('pointermove',move);window.addEventListener('pointerup',end,{once:true});window.addEventListener('pointercancel',cancelDrag,{once:true});window.addEventListener('keydown',escapeDrag);
}
function selectEditableCard(id){activeCardId=id;$('#canvas').querySelectorAll('.card').forEach(card=>card.classList.toggle('card-selected',card.dataset.id===id||groupSelection.has(card.dataset.id)));updateGroupToolbar();}
$('#canvas').addEventListener('pointerdown',e=>{
 if(e.button!==0)return;
 const card=e.target.closest('.card');if(!card)return;
 if(e.shiftKey&&!e.target.closest('button,input,select,a')){e.preventDefault();toggleGroupCard(card.dataset.id);return;}
 if(e.target.closest('.handle')&&(editing||card.dataset.id===activeCardId||groupSelection.has(card.dataset.id))){selectEditableCard(card.dataset.id);startCardDrag(e);return;}
 if(e.target.closest('button,input,select,textarea,a,summary,label,.card-controls'))return;
 if(e.pointerType==='mouse')e.preventDefault();
 const x=e.clientX,y=e.clientY;card.classList.add('hold-pending');
 const cleanup=()=>{clearTimeout(timer);card.classList.remove('hold-pending');window.removeEventListener('pointermove',cancelOnMove);window.removeEventListener('pointerup',cleanup);window.removeEventListener('pointercancel',cleanup);window.removeEventListener('blur',cleanup);};
 const cancelOnMove=ev=>{if(Math.hypot(ev.clientX-x,ev.clientY-y)>8)cleanup();};
 const timer=setTimeout(()=>{cleanup();selectEditableCard(card.dataset.id);startCardDrag(e);},350);
 window.addEventListener('pointermove',cancelOnMove);window.addEventListener('pointerup',cleanup,{once:true});window.addEventListener('pointercancel',cleanup,{once:true});window.addEventListener('blur',cleanup,{once:true});
});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#canvas .card,.group-toolbar'))selectEditableCard(null)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){groupSelection.clear();selectEditableCard(null);}});
function chartTitle(c){
 const metric=c.type==='table'?(integration.view==='micro-ads'?'Anúncios':integration.view.startsWith('micro')?'Conjuntos de anúncios':'Campanhas'):c.type==='funnel'?'Funis comparativos':c.type==='scatter'?'Investimento × resultados':c.type==='radar'?'Perfil de desempenho':metricLabels[c.metric];
 const period=c.period==='global'?(integration.periodMode||'custom'):c.period;
 const suffix={today:'de hoje',week:'da semana',month:'do mês','7':'dos últimos 7 dias','14':'dos últimos 14 dias','30':'dos últimos 30 dias'}[period];
 const [start,end]=range(c);
 const dates=start===end?`de ${short(start)}`:`de ${short(start)} a ${short(end)}`;
 return `${metric} ${suffix||dates}${c.group==='hour'?' · por hora':''}`;
}
function chartCampaigns(c){return Array.isArray(c.campaignIds)?c.campaignIds.filter(i=>Number.isInteger(i)&&campaigns[i]):selected;}
function campaignControls(c){const ids=chartCampaigns(c),inherited=!Array.isArray(c.campaignIds);return `<fieldset class="chart-campaigns"><legend>Campanhas deste gráfico</legend><div class="campaign-selection-actions"><label class="follow-global"><input type="checkbox" data-campaign-mode="global" ${inherited?'checked':''}>Seguir filtro geral</label><label><input type="checkbox" data-campaign-mode="all" ${ids.length===campaigns.length?'checked':''}>Selecionar todas</label></div><div class="campaign-checks">${campaigns.map((campaign,i)=>`<label><input type="checkbox" data-campaign-id="${i}" ${ids.includes(i)?'checked':''}><i style="background:${campaign.color}"></i><span title="${escapeLabel(campaign.name)}">${escapeLabel(campaign.name)}</span></label>`).join('')}</div></fieldset>`;}
document.addEventListener('change',e=>{
 const mode=e.target.dataset.campaignMode,id=e.target.dataset.campaignId;if(!mode&&id===undefined)return;
 const expanded=!!e.target.closest('#expanded'),c=cards.find(c=>c.id===e.target.closest('.card').dataset.id),original={...c};
 if(mode==='global')c.campaignIds=e.target.checked?null:[...selected];
 else if(mode==='all')c.campaignIds=e.target.checked?campaigns.map((_,i)=>i):[];
 else{const ids=new Set(chartCampaigns(c));if(e.target.checked)ids.add(+id);else ids.delete(+id);c.campaignIds=[...ids].sort((a,b)=>a-b);}
 const duplicate=existingChart(c);if(duplicate){Object.assign(c,original);refresh();showExistingChart(duplicate);return;}const updated={...c};Object.assign(c,original);checkpoint();Object.assign(c,updated);
 refresh();const host=expanded?$('#expanded-content'):$('#canvas'),card=[...host.querySelectorAll('.card')].find(el=>el.dataset.id===c.id);if(card){$('.card-controls',card).hidden=false;$('.filter-toggle',card).setAttribute('aria-expanded','true');}
});
function closeChartFilters(){document.querySelectorAll('.card-controls').forEach(panel=>panel.hidden=true);document.querySelectorAll('.filter-toggle').forEach(button=>button.setAttribute('aria-expanded','false'));}
document.addEventListener('click',e=>{if(!e.target.closest('.card-controls')&&!e.target.closest('.filter-toggle'))closeChartFilters()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeChartFilters()});
function organizeCanvas(){
 const before=layoutSnapshot();
 packCanvas();
 fitRenderedCharts();
 animateLayout(before);
 persist();
 toast('Espaços compactados. Ordem e tamanhos foram preservados.');
}
$('#organize').onclick=organizeCanvas;
if(false){checkpoint();cards.forEach(c=>{c.span=6;c.height=340});localStorage.setItem('descomplica-canvas-organized-v2','1');}
function layoutSnapshot(){return new Map([...$('#canvas').children].map(el=>[el.dataset.id,el.getBoundingClientRect()]));}
function animateLayout(before,exceptId){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 for(const el of $('#canvas').children){el.getAnimations().forEach(a=>a.cancel());const old=before.get(el.dataset.id),now=el.getBoundingClientRect();if(reduced||!old||el.dataset.id===exceptId)continue;const dx=old.left-now.left,dy=old.top-now.top,sx=old.width/now.width,sy=old.height/now.height;if(Math.abs(dx)+Math.abs(dy)+Math.abs(old.width-now.width)+Math.abs(old.height-now.height)<1)continue;el.animate([{transform:`translate(${dx}px,${dy}px) scale(${sx},${sy})`},{transform:'none'}],{duration:480,easing:'cubic-bezier(.2,.75,.25,1)'});}
}
function packCanvas(resizingId,layoutCards=cards){
 const mobile=matchMedia('(max-width:700px)').matches,layoutRows=[];let row=[],used=0;
 for(const c of layoutCards){const span=mobile?60:Math.round(c.span*5);if(used+span>60&&row.length){layoutRows.push(row);row=[];used=0;}row.push({c,span});used+=span;}if(row.length)layoutRows.push(row);
 const elements=new Map([...$('#canvas').children].map(el=>[el.dataset.id,el]));let gridRow=1;
 for(const group of layoutRows){
  let spare=60-group.reduce((s,item)=>s+item.span,0);const recipient=group.findLast(item=>item.c.id!==resizingId)||group[0];recipient.span+=spare;
  const active=group.find(item=>item.c.id===resizingId);
  // Funnel height comes from its visible rows, not a previously larger size.
  let height=active&&active.c.type!=='funnel'
   ?Math.max(active.c.height,...group.filter(item=>item.c.type!=='funnel').map(item=>cardMinHeight(item.c)))
   :Math.max(0,...group.filter(item=>item.c.type!=='funnel').map(item=>item.c.height));
  for(const item of group){
   if(item.c.type!=='funnel')continue;
   const element=elements.get(item.c.id);if(!element)continue;
   const count=chartCampaigns(item.c).length;
   const width=($('#canvas').clientWidth-24)*item.span/60-16;
   const columns=Math.max(1,Math.min(3,Math.floor((width-12)/210)));
   element.style.setProperty('--funnel-columns',columns);
   element.classList.toggle('funnel-all-visible',count<=9);
   const funnelRows=rows(item.c);
   const stageCount=sharedFunnelStages(chartCampaigns(item.c).map(i=>host.aggregate(funnelRows.filter(row=>row.i===i)))).length;
   const rowHeight=90+stageCount*30;
   element.style.setProperty('--funnel-tile-height',(rowHeight-10)+'px');
   const visibleCount=Math.min(count,9);
   const fittedHeight=count===0?184:Math.ceil((110+Math.ceil(visibleCount/columns)*rowHeight+16)/20)*20-16;
   item.c.height=fittedHeight;
   height=Math.max(height,fittedHeight);
  }
  const units=(height+16)/20;let column=1;
  for(const {c,span} of group){const el=elements.get(c.id);if(!el)continue;el.style.setProperty('--span',span);el.style.setProperty('--height',height+'px');el.style.setProperty('--rows',units);el.style.setProperty('--column-start',column);el.style.setProperty('--row-start',gridRow);column+=span;if(active)c.height=height;}
  gridRow+=units;
 }
}
function canvasPitch(){const grid=$('#canvas'),style=getComputedStyle(grid);return (grid.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight))/12;}
let packedWidth=0;
new ResizeObserver(()=>{const width=$('#canvas').clientWidth;$('#canvas').style.setProperty('--column-pitch',canvasPitch()+'px');if(width!==packedWidth){packedWidth=width;packCanvas();fitRenderedCharts();}}).observe($('#canvas'));
render();

function plot(c,size={}){const markup=decoratePlot(c,size,basePlot(c,size));return comparablePeriodCards(c).length>1?markup+'<small class="scale-reference">Escala compartilhada entre períodos · referência: maior valor</small>':markup;}

document.addEventListener('click',event=>{const row=event.target.closest('[data-open]');if(row&&row.closest('[data-chart-type="table"]'))host.openCampaign(row.dataset.open);});

function canvasVisualRows(){
 const result=[];
 for(const el of $('#canvas').querySelectorAll('.card')){
  const top=el.offsetTop;let row=result.find(item=>Math.abs(item.top-top)<2);
  if(!row){row={top,ids:[]};result.push(row);}row.ids.push(el.dataset.id);
 }
 return result.sort((a,b)=>a.top-b.top);
}
function updateGroupToolbar(){
 const toolbar=document.querySelector('.group-toolbar');if(!toolbar)return;
 for(const id of groupSelection)if(!cards.some(card=>card.id===id))groupSelection.delete(id);
 toolbar.hidden=!groupSelection.size;
 toolbar.querySelector('span').textContent=groupSelection.size+' selecionados';
 const rows=canvasVisualRows(),index=rows.findIndex(row=>row.ids.some(id=>groupSelection.has(id)));
 toolbar.querySelector('[data-group-move="up"]').disabled=index<=0;
 toolbar.querySelector('[data-group-move="down"]').disabled=index<0||index>=rows.length-1;
 document.querySelectorAll('[data-group-select]').forEach(button=>button.setAttribute('aria-pressed',String(groupSelection.has(button.dataset.groupSelect))));
}
function toggleGroupCard(id){
 if(groupSelection.has(id))groupSelection.delete(id);
 else{
  const row=canvasVisualRows().find(row=>row.ids.includes(id));
  if(groupSelection.size&&![...groupSelection].every(selected=>row?.ids.includes(selected))){toast('Selecione gráficos da mesma linha para movê-los juntos.');return;}
  groupSelection.add(id);
 }
 selectEditableCard(activeCardId);
}
function moveSelectedGroup(direction){
 const rows=canvasVisualRows(),index=rows.findIndex(row=>row.ids.some(id=>groupSelection.has(id))),target=rows[index+(direction==='up'?-1:1)];
 if(!target)return;
 const moving=cards.filter(card=>groupSelection.has(card.id)),remaining=cards.filter(card=>!groupSelection.has(card.id));
 const boundary=direction==='up'?target.ids[0]:target.ids.at(-1);
 const insert=remaining.findIndex(card=>card.id===boundary)+(direction==='up'?0:1);
 checkpoint();remaining.splice(insert,0,...moving);cards=remaining;render();updateGroupToolbar();
 const first=[...$('#canvas').children].find(el=>el.dataset.id===moving[0]?.id);first?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'center'});
}
const groupToolbar=document.createElement('div');groupToolbar.className='group-toolbar';groupToolbar.hidden=true;
groupToolbar.innerHTML='<span></span><button data-group-move="up" aria-label="Mover selecionados para cima">↑ Subir</button><button data-group-move="down" aria-label="Mover selecionados para baixo">↓ Descer</button><button data-group-clear>Limpar seleção</button>';
document.querySelector('.heading .actions').prepend(groupToolbar);
document.addEventListener('click',event=>{
 const select=event.target.closest('[data-group-select]');if(select){toggleGroupCard(select.dataset.groupSelect);return;}
 const move=event.target.closest('[data-group-move]');if(move)moveSelectedGroup(move.dataset.groupMove);
 if(event.target.closest('[data-group-clear]')){groupSelection.clear();selectEditableCard(null);}
});
