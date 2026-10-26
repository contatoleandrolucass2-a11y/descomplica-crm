(() => {
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover:hover) and (pointer:fine)');let active=null,pressed=false;
 function reset(){if(active){active.classList.remove('comet-hover');for(const name of ['--tilt-x','--tilt-y','--shift-x','--shift-y'])active.style.removeProperty(name);active=null;}}
 document.addEventListener('pointerdown',()=>{pressed=true;reset();});
 for(const name of ['pointerup','pointercancel'])document.addEventListener(name,()=>pressed=false);
 document.addEventListener('pointermove',event=>{
  if(reduced.matches||!fine.matches||pressed||event.pointerType==='touch')return;
  const card=event.target.closest('.merged-funnels > article,.funnels > .funnel,.card[data-chart-type="bars"] .chart svg rect,.card[data-chart-type="horizontal"] .chart svg rect');if(!card||(card.tagName.toLowerCase()==='rect'&&!card.querySelector('desc[data-tip-name]'))){reset();return;}
  if(active!==card){reset();active=card;}
  const box=card.getBoundingClientRect(),x=Math.max(-.5,Math.min(.5,(event.clientX-box.left)/box.width-.5)),y=Math.max(-.5,Math.min(.5,(event.clientY-box.top)/box.height-.5));
  const singleFunnel=card.matches('.merged-funnels > article:only-child,.funnels > .funnel:only-child');
  // Large single funnels need proportionally less perspective distortion.
  const tilt=singleFunnel?.5*Math.min(1,500/Math.max(1,box.width)):4;
  const shift=singleFunnel?1:4;
  card.classList.add('comet-hover');card.style.setProperty('--tilt-x',(-y*tilt)+'deg');card.style.setProperty('--tilt-y',(x*tilt)+'deg');card.style.setProperty('--shift-x',(x*shift)+'px');card.style.setProperty('--shift-y',(-y*shift)+'px');card.style.setProperty('--glare-x',(x+.5)*100+'%');card.style.setProperty('--glare-y',(y+.5)*100+'%');
 });
 document.addEventListener('pointerout',event=>{if(active&&!active.contains(event.relatedTarget))reset();});window.addEventListener('blur',()=>{pressed=false;reset();});reduced.addEventListener('change',reset);
})();
