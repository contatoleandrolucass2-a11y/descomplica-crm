import { METRICS } from './glossary.mjs';
export const $ = (selector,root=document) => root.querySelector(selector);
export const $$ = (selector,root=document) => [...root.querySelectorAll(selector)];
export const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const icon=(name,extra='')=>`<svg class="icon ${extra}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
export const dateLabel=(date,opts={})=>new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',timeZone:'UTC',...opts}).format(new Date(date+'T12:00:00Z'));
export const longDate=date=>new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
export const help=key=>`<button class="metric-help" data-help="${key}" aria-label="Entender ${esc(METRICS[key]?.name || key)}" title="O que é e como calcular">${icon('info')}</button>`;
export const metricLabel=(key,short=false)=>`<span class="metric-label">${esc(METRICS[key]?.abbr || key)}${help(key)}${short?'':`<small>${esc(METRICS[key]?.name || key)}</small>`}</span>`;
let toastTimer,lastFocus,stack=[];
export function notify(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4500);}
export function openModal(title,subtitle,body,footer='',wide=false,nested=false){
  const root=$('#modal-root');
  if(nested&&root.firstElementChild)stack.push({node:root.firstElementChild,focus:document.activeElement});else{stack=[];lastFocus=document.activeElement;}
  root.replaceChildren();
  root.innerHTML=`<div class="modal-backdrop"><section class="modal ${wide?'modal-wide':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"><div class="modal-header"><div><h2 id="modal-title">${title}</h2><p>${subtitle}</p></div><button class="icon-button" data-close-modal aria-label="Fechar janela">${icon('close')}</button></div><div class="modal-body">${body}</div>${footer?`<div class="modal-footer">${footer}</div>`:''}</section></div>`;
  document.body.style.overflow='hidden';$('.modal').focus();
  $('.modal-backdrop').addEventListener('click',e=>{if(e.target.classList.contains('modal-backdrop'))closeModal();});
}
export function closeModal(){const root=$('#modal-root');root.replaceChildren();if(stack.length){const previous=stack.pop();root.append(previous.node);previous.focus?.focus();}else{document.body.style.overflow='';if(lastFocus?.isConnected)lastFocus.focus();}}
export function definitionModal(key){
  const m=METRICS[key];if(!m)return;
  openModal(esc(m.abbr),esc(m.name),`<p>${esc(m.definition)}</p><div class="formula-box"><small>COMO É CALCULADO</small><strong>${esc(m.formula)}</strong></div><div class="metric-example"><strong>Exemplo</strong><p>${esc(m.example)}</p></div><div class="callout">${icon('info')}${esc(m.interpret)}</div>`,'<button class="button primary" data-close-modal>Entendi</button>',true,true);
}
export function glossaryModal(){
  openModal('Guia de métricas','Significado, fórmula, exemplo e interpretação de cada indicador.',`<label class="search-field glossary-search">${icon('search')}<input type="search" id="glossary-search" placeholder="Buscar CPL, CPM, frequência..." aria-label="Buscar definição"></label><div class="glossary-list">${Object.entries(METRICS).map(([key,m])=>`<article data-glossary-item="${esc(m.abbr+' '+m.name)}"><h3>${esc(m.abbr)} <span>${esc(m.name)}</span></h3><p>${esc(m.definition)}</p><code>${esc(m.formula)}</code><button class="text-button" data-help="${key}">Ver exemplo e interpretação ${icon('arrow')}</button></article>`).join('')}</div>`,'<button class="button primary" data-close-modal>Fechar guia</button>',true);
  $('#glossary-search').addEventListener('input',e=>{const q=e.target.value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();$$('[data-glossary-item]').forEach(el=>el.hidden=!el.dataset.glossaryItem.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q));});
}
document.addEventListener('click',e=>{if(e.target.closest('[data-close-modal]'))closeModal();const button=e.target.closest('[data-help]');if(button)definitionModal(button.dataset.help);});
document.addEventListener('keydown',e=>{
  const modal=$('.modal');if(!modal)return;
  if(e.key==='Escape'){e.preventDefault();closeModal();}
  if(e.key==='Tab'){const list=$$('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),[tabindex="0"]',modal).filter(el=>el.offsetParent!==null);const first=list[0],last=list.at(-1);if(!first){e.preventDefault();return;}if(e.shiftKey&&(document.activeElement===first||document.activeElement===modal)){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===modal)){e.preventDefault();first.focus();}}
});
export function download(name,content,type='text/csv;charset=utf-8'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
