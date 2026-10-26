(() => {
 const main=document.querySelector('main');
 if(typeof host==='undefined'){
  const controls=document.createElement('div');controls.className='canvas-fixed-controls';
  main.prepend(controls);for(const selector of ['.heading','.filters']){const node=main.querySelector(selector);if(node)controls.append(node);}
  new ResizeObserver(()=>document.documentElement.style.setProperty('--canvas-controls-height',(controls.offsetHeight+64)+'px')).observe(controls);
 }
})();
