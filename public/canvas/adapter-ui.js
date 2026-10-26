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
const refreshNote=document.createElement('small');refreshNote.className='integration-refresh';refreshNote.textContent='Consultado às '+new Date().toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo'})+' · 60 s';
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
async function refreshIntegrated(){
 if(pointerBusy||document.querySelector('dialog[open]'))return;
 try{
  const changed=await host.refresh();
  if(changed){
   const old=new Map([...document.querySelectorAll('#canvas .card')].map(el=>[el.dataset.id,new Map([...el.querySelectorAll('desc[data-tip-name]')].map(d=>[JSON.stringify([d.dataset.tipName,d.dataset.tipDate,d.dataset.tipMetric]),d.dataset.tipValue]))]));
   const next=host.context();Object.assign(integration,next);campaigns.splice(0,campaigns.length,...next.entities);
   render(false);
   for(const el of document.querySelectorAll('#canvas .card')){
    let changed=false;
    for(const desc of el.querySelectorAll('desc[data-tip-name]')){const key=JSON.stringify([desc.dataset.tipName,desc.dataset.tipDate,desc.dataset.tipMetric]);if(old.get(el.dataset.id)?.has(key)&&old.get(el.dataset.id).get(key)!==desc.dataset.tipValue){desc.parentNode.classList.add('live-point');changed=true;}}
    if(changed){el.classList.add('live-updated');addColumnBorderMagic(el);setTimeout(()=>{el.classList.remove('live-updated');el.querySelectorAll('.column-border-magic').forEach(node=>node.remove());el.querySelectorAll('.live-point').forEach(node=>node.classList.remove('live-point'));},7000);}
   }
  }
  refreshNote.textContent='Consultado às '+new Date().toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo'})+' · 60 s';
 }catch{refreshNote.textContent='Consulta indisponível · dados anteriores preservados';}
 publishCanvasStatus();
}
setInterval(refreshIntegrated,60000);
notifyHeight();

window.exportCanvasSnapshot=()=>cards.map(card=>{
 const data=rows(card),ids=chartCampaigns(card),[start,end]=range(card),markup=plot(card,{width:760,height:340});
 const template=document.createElement('template');template.innerHTML=markup;
 const svg=template.content.querySelector('svg');
 return {title:chartTitle(card),context:start+' a '+end+' · '+ids.map(i=>campaigns[i].name).join(', ')+' · Meta Marketing API',svg:svg?.outerHTML||null,headers:['Campanha / item',metricLabels[card.metric],'Teto / limite'],rows:ids.map(i=>[campaigns[i].name,fmt(aggregate(data.filter(row=>row.i===i),card.metric),card.metric),fmt(referenceFor(campaigns[i],card.metric),card.metric)])};
});
