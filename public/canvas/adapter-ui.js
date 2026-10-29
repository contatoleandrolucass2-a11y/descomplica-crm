function addColumnBorderMagic(chart){
 for(const column of chart.querySelectorAll('rect.live-point')){
  const x=Number(column.getAttribute('x')),y=Number(column.getAttribute('y'));
  const width=Number(column.getAttribute('width')),height=Number(column.getAttribute('height'));
  if(width<=0||height<=0)continue;
  const overlay=document.createElementNS('http://www.w3.org/2000/svg','foreignObject');
  overlay.classList.add('column-border-magic');
  overlay.setAttribute('x',x-1);overlay.setAttribute('y',y-1);
  overlay.setAttribute('width',width+2);overlay.setAttribute('height',height+2);
  overlay.setAttribute('aria-hidden','true');
  const border=document.createElementNS('http://www.w3.org/1999/xhtml','div');
  border.className='column-border-magic-ring';
  overlay.append(border);column.parentNode.append(overlay);
 }
}
// The surrounding dashboard owns account, status, destination and global dates.
$('#period').value='custom';$('#start').value=integration.range.start;$('#end').value=integration.range.end;
document.body.dataset.theme=integration.theme;
const subtitle=document.createElement('p');subtitle.className='integration-note';subtitle.textContent=integration.source+' · filtros gerais acima · tetos configurados em Limites';$('.heading').after(subtitle);
function notifyHeight(){window.parent.postMessage({type:'canvas:height',height:document.querySelector('main').scrollHeight+24},'*');}
const canvasMain=document.querySelector('main');
if(canvasMain)new ResizeObserver(notifyHeight).observe(canvasMain);
const parentBody=window.parent.document.body;
if(parentBody){
 const ParentMutationObserver=window.parent.MutationObserver;
 new ParentMutationObserver(()=>{if(document.body)document.body.dataset.theme=host.context().theme;}).observe(parentBody,{attributes:true,attributeFilter:['data-theme']});
}
for(const dialog of document.querySelectorAll('dialog')){
 new MutationObserver(()=>{
  const open=Boolean(document.querySelector('dialog[open]'));
  window.parent.postMessage({type:'canvas:modal',open},'*');
 }).observe(dialog,{attributes:true,attributeFilter:['open']});
}
const LIVE_REFRESH_MS=10000;
const refreshNote=document.createElement('small');refreshNote.className='integration-refresh';refreshNote.textContent='Consultado às '+new Date().toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo'})+' · 10 s';
function publishCanvasStatus(){
 const count=$('#count')?.textContent.split(' · ')[0]||'0 gráficos';
 const controls=[...document.querySelectorAll('.heading .actions button')]
  .filter(button=>!button.closest('.group-toolbar')?.hidden)
  .map(button=>({
   key:button.id||button.dataset.groupMove&&'group-'+button.dataset.groupMove||button.hasAttribute('data-group-clear')&&'group-clear',
   label:button.textContent.trim(),disabled:button.disabled,primary:button.classList.contains('primary')
  })).filter(control=>control.key);
 window.parent.postMessage({type:'canvas:status',count,refresh:refreshNote.textContent,controls},'*');
}
const statusCount=$('#count');
const statusActions=document.querySelector('.heading .actions');
if(statusCount)new MutationObserver(publishCanvasStatus).observe(statusCount,{childList:true,characterData:true,subtree:true});
if(statusActions)new MutationObserver(publishCanvasStatus).observe(statusActions,{attributes:true,childList:true,characterData:true,subtree:true,attributeFilter:['disabled','hidden','class']});
window.addEventListener('message',event=>{
 if(event.source!==window.parent||event.data?.type!=='canvas:command')return;
 const key=event.data.key;
 const target=key==='group-up'?document.querySelector('[data-group-move="up"]'):
  key==='group-down'?document.querySelector('[data-group-move="down"]'):
  key==='group-clear'?document.querySelector('[data-group-clear]'):document.getElementById(key);
 target?.click();queueMicrotask(publishCanvasStatus);
});
publishCanvasStatus();
let pointerBusy=false;document.addEventListener('pointerdown',()=>pointerBusy=true);for(const event of ['pointerup','pointercancel'])document.addEventListener(event,()=>pointerBusy=false);
let refreshBusy=false,lastRefreshAt=Date.now(),retryAfterUntil=0;
function metricNumber(value){
 const normalized=String(value??'').replace(/[^\d,.-]/g,'');
 if(!normalized)return NaN;
 return Number(normalized.includes(',')?normalized.replace(/\./g,'').replace(',','.'):normalized);
}
function liveSnapshot(root=document){
 return new Map([...root.querySelectorAll('#canvas .card')].map(card=>{
  const values=new Map([...card.querySelectorAll('desc[data-tip-name]')].map(desc=>[
   JSON.stringify([desc.dataset.tipName,desc.dataset.tipDate,desc.dataset.tipMetric]),metricNumber(desc.dataset.tipValue)
  ]));
  const metric=card.querySelector('.metric-tile strong');
  if(metric)values.set('metric-total',metricNumber(metric.textContent));
  return [card.dataset.id,values];
 }));
}
async function refreshIntegrated(){
 if(refreshBusy||document.hidden||pointerBusy||document.querySelector('dialog[open]')||Date.now()<retryAfterUntil)return;
 refreshBusy=true;
 try{
  const old=liveSnapshot();
  const changed=await host.refresh();
  if(changed){
   const next=host.context();Object.assign(integration,next);campaigns.splice(0,campaigns.length,...next.entities);
   selected=campaigns.map((campaign,index)=>next.selected.includes(campaign.id)?index:-1).filter(index=>index>=0);
   render(false);
   for(const el of document.querySelectorAll('#canvas .card')){
    let increased=false;
    for(const desc of el.querySelectorAll('desc[data-tip-name]')){const key=JSON.stringify([desc.dataset.tipName,desc.dataset.tipDate,desc.dataset.tipMetric]),before=old.get(el.dataset.id)?.get(key),after=metricNumber(desc.dataset.tipValue);if(Number.isFinite(before)&&Number.isFinite(after)&&after>before){desc.parentNode.classList.add('live-point');increased=true;}}
    const metric=el.querySelector('.metric-tile strong'),before=old.get(el.dataset.id)?.get('metric-total'),after=metricNumber(metric?.textContent);
    if(metric&&Number.isFinite(before)&&Number.isFinite(after)&&after>before){metric.classList.add('live-value');increased=true;}
    if(increased){el.classList.add('live-updated');addColumnBorderMagic(el);setTimeout(()=>{el.classList.remove('live-updated');el.querySelectorAll('.column-border-magic').forEach(node=>node.remove());el.querySelectorAll('.live-point,.live-value').forEach(node=>node.classList.remove('live-point','live-value'));},4000);}
   }
  }
  lastRefreshAt=Date.now();
  refreshNote.textContent='Consultado às '+new Date().toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo'})+' · 10 s';
 }catch(error){
  const retrySeconds=Math.max(0,Number(error?.retryAfter)||0);
  retryAfterUntil=retrySeconds?Date.now()+retrySeconds*1000:0;
  lastRefreshAt=Date.now();
  refreshNote.textContent=retrySeconds?'Meta temporariamente indisponível · nova tentativa em '+retrySeconds+' s':'Consulta indisponível · dados anteriores preservados';
 }
 finally{refreshBusy=false;}
 publishCanvasStatus();
}
setInterval(refreshIntegrated,LIVE_REFRESH_MS);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastRefreshAt>=LIVE_REFRESH_MS)refreshIntegrated();});
window.addEventListener('focus',()=>{if(Date.now()-lastRefreshAt>=LIVE_REFRESH_MS)refreshIntegrated();});
notifyHeight();

window.exportCanvasSnapshot=()=>cards.map(card=>{
 const data=rows(card),ids=chartCampaigns(card),[start,end]=range(card),markup=plot(card,{width:760,height:340});
 const template=document.createElement('template');template.innerHTML=markup;
 const svg=template.content.querySelector('svg');
 return {title:chartTitle(card),context:start+' a '+end+' · '+ids.map(i=>campaigns[i].name).join(', ')+' · Meta Marketing API',svg:svg?.outerHTML||null,headers:['Campanha / item',metricLabels[card.metric],'Teto / limite'],rows:ids.map(i=>[campaigns[i].name,fmt(aggregate(data.filter(row=>row.i===i),card.metric),card.metric),fmt(referenceFor(campaigns[i],card.metric),card.metric)])};
});
