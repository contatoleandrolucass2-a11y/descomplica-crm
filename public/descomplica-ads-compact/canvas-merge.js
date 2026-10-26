/* Local-only integration: the existing analytical model remains authoritative. */
const originalMacro = macro, originalMicro = micro;
window.CanvasHost = {
  context() {
    const micro = state.page === 'micro';
    const all = micro ? groupsForCampaign(campaigns.find(c => c.id === state.selected) || {}, state.detail === 'sets' ? 'adset' : 'ad') : campaigns;
    return {
      scope: (document.documentElement.dataset.storageScope || 'anonymous') + '-' + (micro ? 'micro-' + state.detail : 'macro'),
      view: micro ? 'micro-' + state.detail : 'macro',
      entities: all.map(c => ({...c, name:c.label || c.name, cap:capFor(c), budget:budgetFor(c)?.limit ?? null})),
      selected: micro ? all.map(c=>c.id) : state.ids,
      range:selectedRange(), periodMode:state.periodMode, sourceRange:sourceData.range,
      resultName:resultName(), costName:costName(), compare:state.compare,
      theme:document.documentElement.dataset.theme || document.body.dataset.theme || 'light',
      source:'Meta Marketing API · somente leitura',
    };
  },
  rows(entity, range) { return AdsData.selectEntity(AdsData.filter(sourceData.rows,state,range),entity); },
  aggregate(rows) { return AdsData.aggregate(rows); },
  campaignTableFor(entities,range){
    if(state.page==='micro'){
      const label=state.detail==='sets'?'Conjunto de anúncios':'Anúncio';
      return `<div class="table-wrap"><table><thead><tr><th>${label}</th><th>Investimento</th><th>${resultName()}</th><th>Custo</th><th>Teto</th></tr></thead><tbody>${entities.map(entity=>`<tr><td><button class="link-button" data-open="${entity.id}">${entity.name}${state.detail==='sets'?' ›':''}</button></td><td>${money(entity.spend)}</td><td>${num(entity.leads)}</td><td>${money(entity.cpl)}</td><td>${entity.cap==null?'—':money(entity.cap)}</td></tr>`).join('')}</tbody></table></div>`;
    }
    const previous={startDate:state.startDate,endDate:state.endDate};
    try{state.startDate=range.start;state.endDate=range.end;return campaignTable(entities.map(entity=>data(entity)));}
    finally{Object.assign(state,previous);}
  },
  openCampaign(id){
    if(state.page==='micro'&&state.detail==='sets'){
      state.selectedSet=id;state.detail='ads';render();window.scrollTo(0,0);return;
    }
    if(!campaigns.some(c=>c.id===id))return;
    state.selected=id;state.page='micro';state.detail='sets';state.organize=false;render();window.scrollTo(0,0);
  },
  async refresh(){
    const response=await fetch('/api/meta-ads/data?'+new URLSearchParams(selectedRange()),{cache:'no-store'});
    if(!response.ok)throw new Error('Fonte indisponível');
    const next=await response.json();if(!Array.isArray(next.rows)||!next.range)throw new Error('Resposta inválida');
    if(JSON.stringify(next.rows)===JSON.stringify(sourceData.rows))return false;
    sourceData=next;rebuildCampaigns();syncAlertHistory();updateAlertCounter();
    const table=document.querySelector('[data-panel="table"] .panel-body');if(table)table.innerHTML=campaignTable(current());
    return true;
  },
  notice(message) { toast(message); },
};
function mergedCanvasPage(html, micro) {
  const template=document.createElement('template');template.innerHTML=html;
  template.content.querySelectorAll('.kpis,.layout-help,#organize,#reset-layout').forEach(el=>el.remove());
  const workspace=template.content.querySelector('.workspace');
  if(!workspace)return html;
  const frame=document.createElement('iframe');frame.id='analysis-canvas';frame.title='Canvas editável de análise';frame.style.cssText='display:block;width:100%;height:900px;border:0;margin:12px 0;background:transparent';
  if(micro)workspace.before(frame);else template.content.querySelector('.foot')?.before(frame);
  workspace.remove();
  const fixed=document.createElement('div');fixed.className='merged-fixed-filters';
  while(template.content.firstChild&&template.content.firstChild!==frame)fixed.append(template.content.firstChild);
  frame.before(fixed);
  return template.innerHTML;
}
macro=()=>mergedCanvasPage(originalMacro(),false);
micro=()=>mergedCanvasPage(originalMicro(),true);
window.addEventListener('message',event=>{
  const frame=document.querySelector('#analysis-canvas');
  if(event.source!==frame?.contentWindow)return;
  if(event.data?.type==='canvas:modal'){frame.classList.toggle('canvas-modal-open',event.data.open);window.parent.postMessage({type:'descomplica:meta-ads-modal-open'},'*');}
  if(event.data?.type==='canvas:height')frame.style.height=Math.max(600,Math.min(20000,event.data.height))+'px';
  if(event.data?.type==='canvas:status'){
    const actions=document.querySelector('.merged-fixed-filters .page-head .actions');
    if(actions){
      let status=actions.querySelector('.canvas-header-status');
      if(!status){status=document.createElement('div');status.className='canvas-header-status';actions.prepend(status);}
      status.innerHTML=`<span>${event.data.count}</span><span>${event.data.refresh}</span>`;
      let controls=actions.querySelector('.canvas-header-controls');
      if(!controls){controls=document.createElement('div');controls.className='canvas-header-controls';status.after(controls);}
      controls.innerHTML=(event.data.controls||[]).map(control=>`<button type="button" data-canvas-command="${control.key}" class="${control.primary?'primary':''}" ${control.disabled?'disabled':''}>${control.label}</button>`).join('');
    }
  }
});
let canvasDocumentPromise;
function hydrateCanvasFrame(){
  const frame=document.querySelector('#analysis-canvas');
  if(!frame||frame.dataset.documentLoading)return;
  frame.dataset.documentLoading='true';
  canvasDocumentPromise??=fetch('/canvas/index.html',{cache:'force-cache'}).then(response=>{
    if(!response.ok)throw new Error('Canvas indisponível');
    return response.text();
  }).then(html=>html.replace(/\b(href|src)="(?!\/|https?:|#)([^"]+)"/g,'$1="/canvas/$2"'));
  canvasDocumentPromise.then(html=>{if(frame.isConnected)frame.srcdoc=html;}).catch(()=>{
    frame.removeAttribute('data-document-loading');
    frame.replaceWith(Object.assign(document.createElement('p'),{className:'banner error',textContent:'Não foi possível carregar o canvas de análise.'}));
  });
}
new MutationObserver(hydrateCanvasFrame).observe(document.querySelector('#main'),{childList:true,subtree:true});
document.addEventListener('click',event=>{
  const command=event.target.closest('[data-canvas-command]');if(!command)return;
  document.querySelector('#analysis-canvas')?.contentWindow?.postMessage({type:'canvas:command',key:command.dataset.canvasCommand},'*');
});
if(sourceData)render();
hydrateCanvasFrame();

const canvasStyles=document.createElement('style');canvasStyles.textContent='#analysis-canvas.canvas-modal-open{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;z-index:9999;background:var(--bg,#f2f6fa)!important}';document.head.append(canvasStyles);

const fullCanvasStyle=document.createElement('style');fullCanvasStyle.textContent=`
body:has(#analysis-canvas) #main{padding:0!important;max-width:none!important;width:100%!important;margin:0!important}
.merged-fixed-filters{position:sticky;top:0;z-index:40;background:var(--bg,#f2f6fa);padding:16px 16px 8px;border-bottom:1px solid var(--border,#30475b)}
#analysis-canvas{margin:0!important}.merged-fixed-filters .page-head{margin-bottom:12px}
body:has(#analysis-canvas) .workspace,body:has(#analysis-canvas) .foot{margin:12px 16px}
`;document.head.append(fullCanvasStyle);

const compactCanvasStyle=document.createElement('style');compactCanvasStyle.textContent=`
.merged-fixed-filters{padding:8px 12px 6px}
.merged-fixed-filters h1{font-size:23px;margin:0 0 3px;line-height:1.2}
.merged-fixed-filters .page-head{margin-bottom:8px;gap:8px}
.merged-fixed-filters .page-head p{font-size:11px;line-height:1.3}
.merged-fixed-filters .filters{margin-bottom:6px;gap:8px}
.merged-fixed-filters .filters .field{padding:6px 10px;gap:2px}
.merged-fixed-filters .comparison-strip{margin:0 0 4px;padding:0;min-height:22px;gap:8px;font-size:11px}
.merged-fixed-filters .source-state{margin:0;font-size:10px;line-height:1.4;gap:6px}
.merged-fixed-filters .source-state small{font-size:10px}
.merged-fixed-filters .banner{padding:7px 10px;margin:5px 0 0}
.merged-fixed-filters .page-head .actions{align-items:center}
.canvas-header-status{display:flex;align-items:center;gap:8px;margin-right:4px;color:var(--muted,#6f8495);font-size:10px;white-space:nowrap;order:1}
.canvas-header-status span+span{padding-left:8px;border-left:1px solid var(--border,#30475b)}
.canvas-header-controls{display:flex;align-items:center;gap:6px;order:2}
.canvas-header-controls button{padding:7px 10px;font-size:11px;white-space:nowrap}
.merged-fixed-filters .pdf-export-group{order:3}
@media(max-width:1100px){.canvas-header-status{width:100%;justify-content:flex-end;order:2}.canvas-header-controls{order:3}}
`;document.head.append(compactCanvasStyle);
