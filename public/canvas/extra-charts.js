function sharedFunnelStages(totals){
 return [['clicks','Cliques'],['opens','Visitas / aberturas'],['leads',integration.resultName],['qualified','Qualificados']]
  .filter(([key])=>totals.some(total=>Number.isFinite(total[key])));
}
function previousRows(card){
 const [start,end]=range(card),count=Math.round((date(end)-date(start))/86400000)+1;
 const finish=date(start);finish.setUTCDate(finish.getUTCDate()-1);
 const begin=new Date(finish);begin.setUTCDate(begin.getUTCDate()-count+1);
 return chartCampaigns(card).flatMap(i=>host.rows(campaigns[i],{start:iso(begin),end:iso(finish)}).map(row=>({...row,day:row.date,i,results:row.conversions})));
}
function extraPlot(card,size){
 const rs=rows(card),ids=chartCampaigns(card),[start,end]=range(card);
 if(!rs.length)return '<div class="empty-chart">— Sem dados para os filtros selecionados.</div>';
 if(card.type==='table')return host.campaignTableFor(ids.map(i=>campaigns[i]),{start,end});
 if(card.type==='kpi'){
  const value=aggregate(rs,card.metric),previous=previousRows(card).length?aggregate(previousRows(card),card.metric):null;
  const delta=previous>0&&value!=null?(value/previous-1)*100:null;
  return `<div class="metric-tile"><span>${escapeLabel(metricLabels[card.metric])}</span><strong title="${escapeLabel(fmt(value,card.metric))}">${escapeLabel(fmt(value,card.metric))}</strong>${integration.compare?`<small>Anterior: ${fmt(previous,card.metric)} · ${delta==null?'—':delta.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%'}</small>`:''}<small>${short(start)} – ${short(end)}</small></div>`;
 }
 if(card.type==='funnel'){
  const totals=ids.map(i=>host.aggregate(rs.filter(row=>row.i===i)));
  const stages=sharedFunnelStages(totals);
  return `<div class="merged-funnels">${ids.map((i,index)=>{
   const total=totals[index];
   return `<article style="--campaign-color:${campaigns[i].color}"><strong title="${escapeLabel(campaigns[i].name)}">${escapeLabel(campaigns[i].name)}</strong>${stages.map(([key,label])=>{
    const value=total[key],available=Number.isFinite(value);
    return `<div class="merged-funnel-row ${available?'':'funnel-stage-empty'}" ${available?'':'aria-hidden="true"'}><span title="${escapeLabel(label)}">${escapeLabel(label)}</span><b>${available?fmt(value,'results'):''}</b><i style="width:${available?Math.min(100,total.clicks?100*value/total.clicks:0):0}%"></i></div>`;
   }).join('')}${total.clicks>0&&Number.isFinite(total.leads)?`<small>Clique → resultado: ${fmt(100*total.leads/total.clicks,'ctr')}</small>`:''}</article>`;
  }).join('')}</div>`;
 }
 if(card.type==='scatter'){
  const W=size.width||560,H=size.height||250,L=56,R=20,T=26,B=38,w=W-L-R,h=H-T-B;
  const points=ids.map(i=>({i,...host.aggregate(rs.filter(row=>row.i===i))}));
  const maxX=Math.max(1,...points.map(p=>p.spend))*1.15,maxY=Math.max(1,...points.map(p=>p.leads))*1.2;
  let svg='';for(let j=0;j<=4;j++){const x=L+w*j/4,y=T+h-h*j/4;svg+=`<line class="grid" x1="${L}" x2="${W-R}" y1="${y}" y2="${y}"/><text x="${L-6}" y="${y+4}" text-anchor="end">${fmt(maxY*j/4,'results')}</text><text x="${x}" y="${T+h+20}" text-anchor="middle">${chartValue(maxX*j/4,'spend',w/4-5,11)}</text>`;}
  for(const point of points){const x=L+w*point.spend/maxX,y=T+h-h*point.leads/maxY,campaign=campaigns[point.i];svg+=`<path d="M ${L} ${y} H ${x} V ${T+h}" stroke="${campaign.color}" stroke-dasharray="3 4" opacity=".4" fill="none"/><circle cx="${x}" cy="${y}" r="6" fill="${campaign.color}">${tooltip(campaign.name,fmt(point.spend,'spend')+' · '+fmt(point.leads,'results')+' '+integration.resultName,short(start)+' – '+short(end),'Investimento / resultados')}</circle>`;}
  return `<svg viewBox="0 0 ${W} ${H}" style="--plot-font:11px" role="img" aria-label="Investimento versus resultados"><text x="${L}" y="14">${integration.resultName}</text>${svg}<text x="${W/2}" y="${H-2}" text-anchor="middle">Investimento (R$)</text></svg>`;
 }
 return '';
}
function referenceFor(campaign,metric){return metric==='cpl'?campaign.cap:metric==='spend'?campaign.budget:null;}
function decoratePlot(card,size,markup){
 if(!markup.includes('<svg')||!['bars','horizontal','line','area'].includes(card.type))return markup;
 const template=document.createElement('template');template.innerHTML=markup;
 const svg=template.content.querySelector('svg');if(!svg)return markup;
 const rs=rows(card),ids=chartCampaigns(card),references=ids.map(i=>referenceFor(campaigns[i],card.metric));
 if(!references.some(value=>value>0))return decorateComparison(card,size,markup);
 const box=svg.viewBox.baseVal,W=box.width,H=box.height;
 const lines=[];
 if(card.group==='campaign'&&card.type==='bars'){
  [...svg.querySelectorAll('rect')].forEach((bar,index)=>{
   const i=ids[index],cap=references[index],value=aggregate(rs.filter(row=>row.i===i),card.metric);
   if(!(cap>0))return;
   const y=Number(bar.getAttribute('y')),height=Number(bar.getAttribute('height')),x=Number(bar.getAttribute('x')),width=Number(bar.getAttribute('width'));
   const scale=value>0?height/value:0;if(!scale)return;
   const limitY=y+height-cap*scale;
   lines.push(`<line x1="${x-4}" x2="${x+width+4}" y1="${limitY}" y2="${limitY}" stroke="#d33a54" stroke-width="2" stroke-dasharray="5 3"><title>Teto ${escapeLabel(campaigns[i].name)}: ${fmt(cap,card.metric)}</title></line>`);
   if(value>cap){bar.setAttribute('stroke','#d33a54');bar.setAttribute('stroke-width','2');svg.querySelectorAll('text[aria-label]').forEach(text=>{if(text.getAttribute('aria-label')===fmt(value,card.metric)&&Math.abs(Number(text.getAttribute('x'))-(x+width/2))<1)text.classList.add('above-cap');});}
  });
 }
 if(card.group==='campaign'&&card.type==='horizontal'){
  [...svg.querySelectorAll('rect')].forEach((bar,index)=>{
   const i=ids[index],cap=references[index],value=aggregate(rs.filter(row=>row.i===i),card.metric);
   if(!(cap>0&&value>0))return;
   const x=Number(bar.getAttribute('x')),y=Number(bar.getAttribute('y')),width=Number(bar.getAttribute('width')),height=Number(bar.getAttribute('height')),limitX=x+cap*width/value;
   lines.push(`<line x1="${limitX}" x2="${limitX}" y1="${y-4}" y2="${y+height+4}" stroke="#d33a54" stroke-width="2" stroke-dasharray="5 3"><title>Teto: ${fmt(cap,card.metric)}</title></line>`);
   if(value>cap){bar.setAttribute('stroke','#d33a54');bar.setAttribute('stroke-width','2');svg.querySelectorAll('text[aria-label]').forEach(text=>{if(text.getAttribute('aria-label')===fmt(value,card.metric)&&Math.abs(Number(text.getAttribute('y'))-(y+17))<1)text.classList.add('above-cap');});}
  });
 }
 if(card.group!=='campaign'&&['line','area'].includes(card.type)){
  const max=Math.max(1,...[...new Set(rs.map(r=>r.day))].flatMap(day=>ids.map(i=>aggregate(rs.filter(r=>r.i===i&&r.day===day),card.metric))),...references.filter(v=>v>0))*1.18;
  const grid=[...svg.querySelectorAll('line.grid')];if(grid.length){const bottom=Number(grid[0].getAttribute('y1')),top=Number(grid.at(-1).getAttribute('y1'));[...new Set(references.filter(v=>v>0))].forEach(cap=>{const y=bottom-cap/max*(bottom-top);lines.push(`<line x1="${grid[0].getAttribute('x1')}" x2="${W-18}" y1="${y}" y2="${y}" stroke="#d33a54" stroke-dasharray="5 3"><title>Teto: ${fmt(cap,card.metric)}</title></line>`);});}
 }
 svg.insertAdjacentHTML('beforeend',lines.join(''));
 return decorateComparison(card,size,template.innerHTML)+`<small class="cap-reference">${card.metric==='cpl'?'Teto por resultado':'Limite de investimento'}: ${ids.map((i,j)=>escapeLabel(campaigns[i].name)+' '+fmt(references[j],card.metric)).join(' · ')} · leitura</small>`;
}

function previousChartMax(card){
 if(!integration.compare)return 0;
 const rs=previousRows(card),ids=chartCampaigns(card);
 if(card.group==='campaign')return Math.max(0,...ids.map(i=>aggregate(rs.filter(row=>row.i===i),card.metric)||0));
 return Math.max(0,...[...new Set(rs.map(row=>row.day))].flatMap(day=>ids.map(i=>aggregate(rs.filter(row=>row.i===i&&row.day===day),card.metric)||0)));
}
function decorateComparison(card,size,markup){
 if(!integration.compare)return markup;
 const prior=previousRows(card);if(!prior.length)return markup+'<small class="cap-reference">Período anterior: — sem dados na fonte.</small>';
 const ids=chartCampaigns(card),template=document.createElement('template');template.innerHTML=markup;
 const svg=template.content.querySelector('svg');if(!svg)return markup;
 if(card.type==='bars'&&card.group==='campaign'){
  [...svg.querySelectorAll('rect')].forEach((bar,index)=>{
   const i=ids[index],now=aggregate(rows(card).filter(row=>row.i===i),card.metric),before=aggregate(prior.filter(row=>row.i===i),card.metric);
   const x=Number(bar.getAttribute('x')),y=Number(bar.getAttribute('y')),width=Number(bar.getAttribute('width')),height=Number(bar.getAttribute('height'));
   if(!(now>0))return;const h=before*height/now;
   bar.setAttribute('width',width*.48);bar.setAttribute('x',x+width*.52);
   svg.insertAdjacentHTML('beforeend',`<rect x="${x}" y="${y+height-h}" width="${width*.48}" height="${h}" fill="${campaigns[i].color}" opacity=".35">${tooltip(campaigns[i].name,fmt(before,card.metric),'Período anterior equivalente',metricLabels[card.metric])}</rect>`);
  });
 }
 if(card.group==='day'&&['line','area'].includes(card.type)){
  const current=rows(card),days=[...new Set(current.map(row=>row.day))],grid=[...svg.querySelectorAll('line.grid')];
  if(grid.length){
   const bottom=Number(grid[0].getAttribute('y1')),top=Number(grid.at(-1).getAttribute('y1')),left=Number(grid[0].getAttribute('x1')),right=Number(grid[0].getAttribute('x2'));
   const max=Math.max(1,previousChartMax(card),...days.flatMap(day=>ids.map(i=>aggregate(current.filter(row=>row.i===i&&row.day===day),card.metric)||0)),...ids.map(i=>referenceFor(campaigns[i],card.metric)||0))*1.18;
   const [start,end]=range(card),count=Math.round((date(end)-date(start))/86400000)+1;
   for(const i of ids){let segment=[];const flush=()=>{if(segment.length>1)svg.insertAdjacentHTML('beforeend',`<polyline points="${segment.join(' ')}" fill="none" stroke="${campaigns[i].color}" opacity=".55" stroke-dasharray="5 4" stroke-width="2"/>`);segment=[];};
    days.forEach((day,j)=>{const previousDate=date(day);previousDate.setUTCDate(previousDate.getUTCDate()-count);const matching=prior.filter(row=>row.i===i&&row.day===iso(previousDate));if(!matching.length){flush();return;}
     const value=aggregate(matching,card.metric),x=left+(days.length===1?(right-left)/2:j*(right-left)/(days.length-1)),y=bottom-value/max*(bottom-top);segment.push(x+','+y);svg.insertAdjacentHTML('beforeend',`<circle cx="${x}" cy="${y}" r="3" fill="white" stroke="${campaigns[i].color}">${tooltip(campaigns[i].name,fmt(value,card.metric),short(iso(previousDate))+' · anterior',metricLabels[card.metric])}</circle>`);
    });flush();
   }
  }
 }
 return template.innerHTML+'<small class="cap-reference">Atual: sólido · anterior: claro/tracejado. Comparação também disponível na tabela.</small>';
}
